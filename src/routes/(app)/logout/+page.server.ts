import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth/session';

// This route only exists to host the logout action — nobody should land here
// via GET, but redirect home defensively if they do.
export const load: PageServerLoad = async () => {
	throw redirect(302, '/');
};

export const actions: Actions = {
	default: async (event) => {
		if (event.locals.session) {
			await invalidateSession(event.locals.session.id);
		}
		deleteSessionTokenCookie(event);
		throw redirect(302, '/login');
	}
};
