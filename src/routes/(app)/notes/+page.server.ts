import { desc, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { notes } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const myNotes = await db
		.select()
		.from(notes)
		.where(eq(notes.userId, locals.user.id))
		.orderBy(desc(notes.updatedAt));

	return { notes: myNotes };
};

export const actions: Actions = {
	createNote: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createNote' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();

		if (!title) {
			return fail(400, { intent: 'createNote' as const, error: 'Title is required' });
		}

		await db.insert(notes).values({ userId: locals.user.id, title, content });

		return { intent: 'createNote' as const, success: true };
	},

	updateNote: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'updateNote' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const noteId = Number(formData.get('noteId'));
		const title = String(formData.get('title') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();

		if (!noteId) {
			return fail(400, { intent: 'updateNote' as const, error: 'Missing note' });
		}
		if (!title) {
			return fail(400, { intent: 'updateNote' as const, error: 'Title is required' });
		}

		const [existing] = await db.select().from(notes).where(eq(notes.id, noteId));
		if (!existing) {
			return fail(404, { intent: 'updateNote' as const, error: 'Note not found' });
		}
		// Notes are strictly personal — no admin/manager override, same as
		// Reminders: nobody else ever edits someone else's notes.
		if (existing.userId !== locals.user.id) {
			return fail(403, { intent: 'updateNote' as const, error: 'You cannot edit this note' });
		}

		await db.update(notes).set({ title, content, updatedAt: new Date() }).where(eq(notes.id, noteId));

		return { intent: 'updateNote' as const, success: true };
	},

	deleteNote: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteNote' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const noteId = Number(formData.get('noteId'));
		if (!noteId) {
			return fail(400, { intent: 'deleteNote' as const, error: 'Missing note' });
		}

		const [existing] = await db.select().from(notes).where(eq(notes.id, noteId));
		if (!existing) {
			return fail(404, { intent: 'deleteNote' as const, error: 'Note not found' });
		}
		if (existing.userId !== locals.user.id) {
			return fail(403, { intent: 'deleteNote' as const, error: 'You cannot delete this note' });
		}

		await db.delete(notes).where(eq(notes.id, noteId));

		return { intent: 'deleteNote' as const, success: true };
	}
};
