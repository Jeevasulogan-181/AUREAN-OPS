import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { generateTempPassword, hashPassword } from '$lib/server/auth/password';
import { invalidateAllUserSessions } from '$lib/server/auth/session';

const ROLES = ['superadmin', 'admin', 'employee'] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const load: PageServerLoad = async () => {
	const staff = await db
		.select({
			id: users.id,
			username: users.username,
			fullName: users.fullName,
			email: users.email,
			role: users.role,
			department: users.department,
			isActive: users.isActive,
			mustResetPassword: users.mustResetPassword,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.createdAt);

	return { staff };
};

export const actions: Actions = {
	// The (admin) layout's `load` only redirects non-superadmins away from the
	// *page* — for a POST to one of these actions, SvelteKit runs the action
	// before it re-runs `load` to build the response, so that redirect fires
	// too late to stop the mutation. Each action re-checks the role itself.
	createEmployee: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') {
			return fail(403, { intent: 'createEmployee' as const, error: 'Superadmin access required' });
		}

		const formData = await request.formData();
		const username = String(formData.get('username') ?? '')
			.trim()
			.toLowerCase();
		const fullName = String(formData.get('fullName') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const department = String(formData.get('department') ?? '').trim() || null;
		const role = formData.get('role');

		if (!username || !fullName || !email) {
			return fail(400, {
				intent: 'createEmployee' as const,
				error: 'Username, full name, and email are required'
			});
		}
		if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
			return fail(400, {
				intent: 'createEmployee' as const,
				error: 'Username must be 3-32 characters: lowercase letters, numbers, dots, dashes, underscores'
			});
		}
		if (!isRole(role)) {
			return fail(400, { intent: 'createEmployee' as const, error: 'Invalid role' });
		}

		const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
		if (existing.length > 0) {
			return fail(400, { intent: 'createEmployee' as const, error: 'That username is already taken' });
		}

		const tempPassword = generateTempPassword();
		const passwordHash = await hashPassword(tempPassword);

		await db.insert(users).values({
			username,
			passwordHash,
			fullName,
			email,
			role,
			department,
			isActive: true,
			mustResetPassword: true
		});

		return { intent: 'createEmployee' as const, success: true, username, tempPassword };
	},

	toggleActive: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') {
			return fail(403, { intent: 'toggleActive' as const, error: 'Superadmin access required' });
		}

		const formData = await request.formData();
		const userId = Number(formData.get('userId'));

		if (!userId) {
			return fail(400, { intent: 'toggleActive' as const, error: 'Missing user' });
		}
		if (userId === locals.user?.id) {
			return fail(400, {
				intent: 'toggleActive' as const,
				error: 'You cannot deactivate your own account'
			});
		}

		const [target] = await db.select().from(users).where(eq(users.id, userId));
		if (!target) {
			return fail(404, { intent: 'toggleActive' as const, error: 'User not found' });
		}

		await db.update(users).set({ isActive: !target.isActive }).where(eq(users.id, userId));

		if (target.isActive) {
			// Was active, now being deactivated — kill any live sessions.
			await invalidateAllUserSessions(userId);
		}

		return { intent: 'toggleActive' as const, success: true };
	},

	resetPassword: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') {
			return fail(403, { intent: 'resetPassword' as const, error: 'Superadmin access required' });
		}

		const formData = await request.formData();
		const userId = Number(formData.get('userId'));

		if (!userId) {
			return fail(400, { intent: 'resetPassword' as const, error: 'Missing user' });
		}

		const [target] = await db.select().from(users).where(eq(users.id, userId));
		if (!target) {
			return fail(404, { intent: 'resetPassword' as const, error: 'User not found' });
		}

		const tempPassword = generateTempPassword();
		const passwordHash = await hashPassword(tempPassword);

		await db
			.update(users)
			.set({ passwordHash, mustResetPassword: true })
			.where(eq(users.id, userId));
		await invalidateAllUserSessions(userId);

		return {
			intent: 'resetPassword' as const,
			success: true,
			username: target.username,
			tempPassword
		};
	},

	changeRole: async ({ request, locals }) => {
		if (locals.user?.role !== 'superadmin') {
			return fail(403, { intent: 'changeRole' as const, error: 'Superadmin access required' });
		}

		const formData = await request.formData();
		const userId = Number(formData.get('userId'));
		const role = formData.get('role');

		if (!userId || !isRole(role)) {
			return fail(400, { intent: 'changeRole' as const, error: 'Invalid request' });
		}
		if (userId === locals.user?.id) {
			return fail(400, { intent: 'changeRole' as const, error: 'You cannot change your own role' });
		}

		await db.update(users).set({ role }).where(eq(users.id, userId));

		return { intent: 'changeRole' as const, success: true };
	}
};
