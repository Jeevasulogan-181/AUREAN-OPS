import { eq, or } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reminders, tasks } from '$lib/server/db/schema';

function parseDateTimeLocal(raw: FormDataEntryValue | null): Date | null {
	const str = String(raw ?? '').trim();
	if (!str) return null;
	const d = new Date(str);
	return Number.isNaN(d.getTime()) ? null : d;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const userId = locals.user.id;

	const myReminders = await db
		.select()
		.from(reminders)
		.where(eq(reminders.userId, userId))
		.orderBy(reminders.remindAt);

	// "The user's own tasks" — either assigned to them or created by them —
	// for the optional task-link dropdown.
	const myTasks = await db
		.select({ id: tasks.id, title: tasks.title })
		.from(tasks)
		.where(or(eq(tasks.assignedTo, userId), eq(tasks.createdBy, userId)))
		.orderBy(tasks.title);

	return { reminders: myReminders, myTasks };
};

export const actions: Actions = {
	createReminder: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createReminder' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const remindAt = parseDateTimeLocal(formData.get('remindAt'));
		const relatedTaskIdRaw = String(formData.get('relatedTaskId') ?? '').trim();

		if (!title) {
			return fail(400, { intent: 'createReminder' as const, error: 'Title is required' });
		}
		if (!remindAt) {
			return fail(400, { intent: 'createReminder' as const, error: 'Reminder date/time is required' });
		}

		await db.insert(reminders).values({
			userId: locals.user.id,
			title,
			remindAt,
			relatedTaskId: relatedTaskIdRaw ? Number(relatedTaskIdRaw) : null
		});

		return { intent: 'createReminder' as const, success: true };
	},

	updateReminder: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'updateReminder' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const reminderId = Number(formData.get('reminderId'));
		if (!reminderId) {
			return fail(400, { intent: 'updateReminder' as const, error: 'Missing reminder' });
		}

		const [existing] = await db.select().from(reminders).where(eq(reminders.id, reminderId));
		if (!existing) {
			return fail(404, { intent: 'updateReminder' as const, error: 'Reminder not found' });
		}
		// Reminders are strictly personal — no admin/manager override, even for
		// superadmin: nobody else edits someone else's personal reminders.
		if (existing.userId !== locals.user.id) {
			return fail(403, { intent: 'updateReminder' as const, error: 'You cannot edit this reminder' });
		}

		const title = String(formData.get('title') ?? '').trim();
		const remindAt = parseDateTimeLocal(formData.get('remindAt'));
		const relatedTaskIdRaw = String(formData.get('relatedTaskId') ?? '').trim();

		if (!title) {
			return fail(400, { intent: 'updateReminder' as const, error: 'Title is required' });
		}
		if (!remindAt) {
			return fail(400, { intent: 'updateReminder' as const, error: 'Reminder date/time is required' });
		}

		await db
			.update(reminders)
			.set({ title, remindAt, relatedTaskId: relatedTaskIdRaw ? Number(relatedTaskIdRaw) : null })
			.where(eq(reminders.id, reminderId));

		return { intent: 'updateReminder' as const, success: true };
	},

	toggleDone: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'toggleDone' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const reminderId = Number(formData.get('reminderId'));
		if (!reminderId) {
			return fail(400, { intent: 'toggleDone' as const, error: 'Missing reminder' });
		}

		const [existing] = await db.select().from(reminders).where(eq(reminders.id, reminderId));
		if (!existing) {
			return fail(404, { intent: 'toggleDone' as const, error: 'Reminder not found' });
		}
		if (existing.userId !== locals.user.id) {
			return fail(403, { intent: 'toggleDone' as const, error: 'You cannot edit this reminder' });
		}

		await db.update(reminders).set({ isDone: !existing.isDone }).where(eq(reminders.id, reminderId));

		return { intent: 'toggleDone' as const, success: true };
	},

	deleteReminder: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteReminder' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const reminderId = Number(formData.get('reminderId'));
		if (!reminderId) {
			return fail(400, { intent: 'deleteReminder' as const, error: 'Missing reminder' });
		}

		const [existing] = await db.select().from(reminders).where(eq(reminders.id, reminderId));
		if (!existing) {
			return fail(404, { intent: 'deleteReminder' as const, error: 'Reminder not found' });
		}
		if (existing.userId !== locals.user.id) {
			return fail(403, { intent: 'deleteReminder' as const, error: 'You cannot delete this reminder' });
		}

		await db.delete(reminders).where(eq(reminders.id, reminderId));

		return { intent: 'deleteReminder' as const, success: true };
	}
};
