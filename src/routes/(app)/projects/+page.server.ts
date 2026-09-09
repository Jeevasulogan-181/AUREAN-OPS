import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { projectMembers, projects, tasks, users } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// All three are independent aggregate queries — fire them concurrently.
	const [rows, memberCounts, taskCounts] = await Promise.all([
		db
			.select({
				id: projects.id,
				name: projects.name,
				description: projects.description,
				status: projects.status,
				ownerId: projects.ownerId,
				ownerName: users.fullName,
				createdAt: projects.createdAt
			})
			.from(projects)
			.innerJoin(users, eq(projects.ownerId, users.id))
			.orderBy(desc(projects.createdAt)),
		db
			.select({ projectId: projectMembers.projectId, count: sql<number>`count(*)::int` })
			.from(projectMembers)
			.groupBy(projectMembers.projectId),
		db
			.select({ projectId: tasks.projectId, count: sql<number>`count(*)::int` })
			.from(tasks)
			.where(isNotNull(tasks.projectId))
			.groupBy(tasks.projectId)
	]);

	const memberCountByProject = new Map(memberCounts.map((r) => [r.projectId, r.count]));
	const taskCountByProject = new Map(taskCounts.map((r) => [r.projectId as number, r.count]));

	const projectList = rows.map((p) => ({
		...p,
		memberCount: memberCountByProject.get(p.id) ?? 0,
		taskCount: taskCountByProject.get(p.id) ?? 0
	}));

	return { projectList };
};

export const actions: Actions = {
	createProject: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not signed in' });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;

		if (!name) {
			return fail(400, { error: 'Project name is required' });
		}

		const [created] = await db
			.insert(projects)
			.values({ name, description, ownerId: locals.user.id, status: 'active' })
			.returning({ id: projects.id });

		// The creator is automatically a member of their own project.
		await db
			.insert(projectMembers)
			.values({ projectId: created.id, userId: locals.user.id, roleInProject: 'owner' })
			.onConflictDoNothing();

		throw redirect(302, `/projects/${created.id}`);
	}
};
