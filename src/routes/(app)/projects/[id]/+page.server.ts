import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { projectMembers, projects, tasks, users } from '$lib/server/db/schema';

const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

function isProjectStatus(value: unknown): value is ProjectStatus {
	return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}
function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

async function loadProjectOr404(projectId: number) {
	const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
	if (!project) {
		throw error(404, 'Project not found');
	}
	return project;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const projectId = Number(params.id);
	if (!projectId) {
		throw error(404, 'Project not found');
	}

	const project = await loadProjectOr404(projectId);

	const members = await db
		.select({
			userId: projectMembers.userId,
			roleInProject: projectMembers.roleInProject,
			fullName: users.fullName,
			username: users.username
		})
		.from(projectMembers)
		.innerJoin(users, eq(projectMembers.userId, users.id))
		.where(eq(projectMembers.projectId, projectId))
		.orderBy(users.fullName);

	const assignee = alias(users, 'assignee');
	const projectTasks = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			status: tasks.status,
			priority: tasks.priority,
			dueDate: tasks.dueDate,
			assignedTo: tasks.assignedTo,
			assigneeName: assignee.fullName
		})
		.from(tasks)
		.leftJoin(assignee, eq(tasks.assignedTo, assignee.id))
		.where(eq(tasks.projectId, projectId))
		.orderBy(desc(tasks.createdAt));

	const memberIds = new Set(members.map((m) => m.userId));
	const availableStaff = await db
		.select({ id: users.id, fullName: users.fullName })
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.fullName);

	const canManage = isManager(locals.user.role) || project.ownerId === locals.user.id;

	return {
		project,
		members,
		projectTasks,
		availableStaff: availableStaff.filter((s) => !memberIds.has(s.id)),
		canManage
	};
};

export const actions: Actions = {
	addMember: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'addMember' as const, error: 'Not signed in' });
		}
		const projectId = Number(params.id);
		const project = await loadProjectOr404(projectId);
		const canManage = isManager(locals.user.role) || project.ownerId === locals.user.id;
		if (!canManage) {
			return fail(403, { intent: 'addMember' as const, error: 'You cannot manage this project' });
		}

		const formData = await request.formData();
		const userId = Number(formData.get('userId'));
		if (!userId) {
			return fail(400, { intent: 'addMember' as const, error: 'Choose an employee to add' });
		}

		await db.insert(projectMembers).values({ projectId, userId }).onConflictDoNothing();

		return { intent: 'addMember' as const, success: true };
	},

	removeMember: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'removeMember' as const, error: 'Not signed in' });
		}
		const projectId = Number(params.id);
		const project = await loadProjectOr404(projectId);
		const canManage = isManager(locals.user.role) || project.ownerId === locals.user.id;
		if (!canManage) {
			return fail(403, { intent: 'removeMember' as const, error: 'You cannot manage this project' });
		}

		const formData = await request.formData();
		const userId = Number(formData.get('userId'));
		if (!userId) {
			return fail(400, { intent: 'removeMember' as const, error: 'Missing member' });
		}
		if (userId === project.ownerId) {
			return fail(400, { intent: 'removeMember' as const, error: 'The project owner cannot be removed' });
		}

		await db
			.delete(projectMembers)
			.where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

		return { intent: 'removeMember' as const, success: true };
	},

	updateStatus: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'updateStatus' as const, error: 'Not signed in' });
		}
		const projectId = Number(params.id);
		const project = await loadProjectOr404(projectId);
		const canManage = isManager(locals.user.role) || project.ownerId === locals.user.id;
		if (!canManage) {
			return fail(403, { intent: 'updateStatus' as const, error: 'You cannot manage this project' });
		}

		const formData = await request.formData();
		const status = formData.get('status');
		if (!isProjectStatus(status)) {
			return fail(400, { intent: 'updateStatus' as const, error: 'Invalid status' });
		}

		await db.update(projects).set({ status }).where(eq(projects.id, projectId));

		return { intent: 'updateStatus' as const, success: true };
	},

	createTask: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createTask' as const, error: 'Not signed in' });
		}
		const projectId = Number(params.id);
		await loadProjectOr404(projectId);

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const assignedToRaw = String(formData.get('assignedTo') ?? '').trim();

		if (!title) {
			return fail(400, { intent: 'createTask' as const, error: 'Title is required' });
		}

		await db.insert(tasks).values({
			title,
			projectId,
			assignedTo: assignedToRaw ? Number(assignedToRaw) : null,
			createdBy: locals.user.id
		});

		return { intent: 'createTask' as const, success: true };
	}
};
