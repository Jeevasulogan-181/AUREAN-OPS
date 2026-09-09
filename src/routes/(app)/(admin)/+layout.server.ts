import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Parent (app) layout has already confirmed the user is logged in — this
// only needs to add the role check for superadmin-only screens.
export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'superadmin') {
		throw error(403, 'Superadmin access required');
	}
};
