import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { verifyPassword } from '$lib/server/auth/password';
import { createSession, generateSessionToken, setSessionTokenCookie } from '$lib/server/auth/session';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const usernameRaw = formData.get('username');
		const password = formData.get('password');

		if (typeof usernameRaw !== 'string' || usernameRaw.trim().length === 0) {
			return fail(400, { error: 'Username is required', username: '' });
		}
		if (typeof password !== 'string' || password.length === 0) {
			return fail(400, { error: 'Password is required', username: usernameRaw });
		}

		const username = usernameRaw.trim().toLowerCase();

		const [user] = await db.select().from(users).where(eq(users.username, username));

		// Same generic error whether the username doesn't exist or the password
		// is wrong, so login can't be used to enumerate valid usernames.
		if (!user) {
			return fail(400, { error: 'Invalid username or password', username });
		}

		if (!user.isActive) {
			return fail(400, {
				error: 'This account has been deactivated. Contact your administrator.',
				username
			});
		}

		const validPassword = await verifyPassword(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, { error: 'Invalid username or password', username });
		}

		const token = generateSessionToken();
		const session = await createSession(token, user.id);
		setSessionTokenCookie(event, token, session.expiresAt);

		if (user.mustResetPassword) {
			throw redirect(302, '/change-password');
		}

		const redirectTo = event.url.searchParams.get('redirectTo');
		throw redirect(302, redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
	}
};
