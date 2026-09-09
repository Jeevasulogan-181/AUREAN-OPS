import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword');
		const newPassword = formData.get('newPassword');
		const confirmPassword = formData.get('confirmPassword');

		if (
			typeof currentPassword !== 'string' ||
			typeof newPassword !== 'string' ||
			typeof confirmPassword !== 'string'
		) {
			return fail(400, { error: 'All fields are required' });
		}
		if (newPassword.length < 8) {
			return fail(400, { error: 'New password must be at least 8 characters' });
		}
		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match' });
		}

		const [user] = await db.select().from(users).where(eq(users.id, locals.user.id));
		if (!user) {
			throw redirect(302, '/login');
		}

		const validCurrent = await verifyPassword(user.passwordHash, currentPassword);
		if (!validCurrent) {
			return fail(400, { error: 'Current password is incorrect' });
		}

		const passwordHash = await hashPassword(newPassword);
		await db
			.update(users)
			.set({ passwordHash, mustResetPassword: false })
			.where(eq(users.id, user.id));

		throw redirect(302, '/');
	}
};
