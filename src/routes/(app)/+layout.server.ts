import { and, eq, lte } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { reminders } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
	}

	// Force employees straight to the password-change screen on first login
	// (and any time an admin resets their password) before they can reach
	// anything else in the app shell.
	if (locals.user.mustResetPassword && url.pathname !== '/change-password') {
		throw redirect(302, '/change-password');
	}

	// Due-today-or-overdue count for the sidebar's Reminders badge. Runs on
	// every navigation within (app), which is fine at this data volume.
	const endOfToday = new Date();
	endOfToday.setHours(23, 59, 59, 999);
	const dueReminders = await db
		.select({ id: reminders.id })
		.from(reminders)
		.where(
			and(eq(reminders.userId, locals.user.id), eq(reminders.isDone, false), lte(reminders.remindAt, endOfToday))
		);

	return { user: locals.user, dueReminderCount: dueReminders.length };
};
