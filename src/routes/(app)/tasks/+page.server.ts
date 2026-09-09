import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { projects, tasks, users } from '$lib/server/db/schema';

const STATUSES = ['todo', 'in_progress', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

function isStatus(value: unknown): value is Status {
	return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}
function isPriority(value: unknown): value is Priority {
	return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}
function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

function parseDueDate(raw: FormDataEntryValue | null): Date | null {
	const str = String(raw ?? '').trim();
	if (!str) return null;
	const d = new Date(str);
	return Number.isNaN(d.getTime()) ? null : d;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const assignee = alias(users, 'assignee');

	// None of these three queries depend on each other — running them
	// concurrently instead of one-after-another cuts this page's DB time
	// from ~3 round trips to ~1 (each round trip to Neon's HTTP endpoint
	// costs real, fixed latency regardless of query size).
	const [rows, staffList, projectList] = await Promise.all([
		db
			.select({
				id: tasks.id,
				title: tasks.title,
				description: tasks.description,
				status: tasks.status,
				priority: tasks.priority,
				dueDate: tasks.dueDate,
				createdAt: tasks.createdAt,
				assignedTo: tasks.assignedTo,
				createdBy: tasks.createdBy,
				projectId: tasks.projectId,
				assigneeName: assignee.fullName,
				projectName: projects.name
			})
			.from(tasks)
			.leftJoin(assignee, eq(tasks.assignedTo, assignee.id))
			.leftJoin(projects, eq(tasks.projectId, projects.id))
			.orderBy(desc(tasks.createdAt)),
		db
			.select({ id: users.id, fullName: users.fullName })
			.from(users)
			.where(eq(users.isActive, true))
			.orderBy(users.fullName),
		db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(projects.name)
	]);

	return { tasks: rows, staffList, projectList };
};

export const actions: Actions = {
	createTask: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createTask' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const assignedToRaw = String(formData.get('assignedTo') ?? '').trim();
		const projectIdRaw = String(formData.get('projectId') ?? '').trim();
		const priority = formData.get('priority');
		const dueDate = parseDueDate(formData.get('dueDate'));

		if (!title) {
			return fail(400, { intent: 'createTask' as const, error: 'Title is required' });
		}
		if (priority && !isPriority(priority)) {
			return fail(400, { intent: 'createTask' as const, error: 'Invalid priority' });
		}

		await db.insert(tasks).values({
			title,
			description,
			assignedTo: assignedToRaw ? Number(assignedToRaw) : null,
			projectId: projectIdRaw ? Number(projectIdRaw) : null,
			createdBy: locals.user.id,
			priority: isPriority(priority) ? priority : 'medium',
			dueDate
		});

		return { intent: 'createTask' as const, success: true };
	},

	updateTask: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'updateTask' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const taskId = Number(formData.get('taskId'));
		if (!taskId) {
			return fail(400, { intent: 'updateTask' as const, error: 'Missing task' });
		}

		const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
		if (!existing) {
			return fail(404, { intent: 'updateTask' as const, error: 'Task not found' });
		}

		const canEdit = isManager(locals.user.role) || existing.createdBy === locals.user.id;
		if (!canEdit) {
			return fail(403, { intent: 'updateTask' as const, error: 'You cannot edit this task' });
		}

		const title = String(formData.get('title') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const assignedToRaw = String(formData.get('assignedTo') ?? '').trim();
		const projectIdRaw = String(formData.get('projectId') ?? '').trim();
		const priority = formData.get('priority');
		const dueDate = parseDueDate(formData.get('dueDate'));

		if (!title) {
			return fail(400, { intent: 'updateTask' as const, error: 'Title is required' });
		}
		if (priority && !isPriority(priority)) {
			return fail(400, { intent: 'updateTask' as const, error: 'Invalid priority' });
		}

		await db
			.update(tasks)
			.set({
				title,
				description,
				assignedTo: assignedToRaw ? Number(assignedToRaw) : null,
				projectId: projectIdRaw ? Number(projectIdRaw) : null,
				priority: isPriority(priority) ? priority : existing.priority,
				dueDate
			})
			.where(eq(tasks.id, taskId));

		return { intent: 'updateTask' as const, success: true };
	},

	updateStatus: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'updateStatus' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const taskId = Number(formData.get('taskId'));
		const status = formData.get('status');

		if (!taskId || !isStatus(status)) {
			return fail(400, { intent: 'updateStatus' as const, error: 'Invalid request' });
		}

		const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
		if (!existing) {
			return fail(404, { intent: 'updateStatus' as const, error: 'Task not found' });
		}

		const canMove =
			isManager(locals.user.role) ||
			existing.createdBy === locals.user.id ||
			existing.assignedTo === locals.user.id;
		if (!canMove) {
			return fail(403, { intent: 'updateStatus' as const, error: 'You cannot update this task' });
		}

		await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));

		return { intent: 'updateStatus' as const, success: true };
	},

	deleteTask: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteTask' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const taskId = Number(formData.get('taskId'));
		if (!taskId) {
			return fail(400, { intent: 'deleteTask' as const, error: 'Missing task' });
		}

		const [existing] = await db.select().from(tasks).where(eq(tasks.id, taskId));
		if (!existing) {
			return fail(404, { intent: 'deleteTask' as const, error: 'Task not found' });
		}

		const canDelete = isManager(locals.user.role) || existing.createdBy === locals.user.id;
		if (!canDelete) {
			return fail(403, { intent: 'deleteTask' as const, error: 'You cannot delete this task' });
		}

		await db.delete(tasks).where(eq(tasks.id, taskId));

		return { intent: 'deleteTask' as const, success: true };
	}
};
