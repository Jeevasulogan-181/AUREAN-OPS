import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { calendarEvents, clockEntries, eventAttendees, tasks, users } from '$lib/server/db/schema';

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}
function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const { id: userId, role, department } = locals.user;

	const now = new Date();
	const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	// Clock status, open tasks, and this week's events are all independent —
	// fire them concurrently rather than paying three separate round trips.
	const [todayClockEntryRows, openTasks, eventRows] = await Promise.all([
		// Today's clock status — always the viewer's own, same as the Clock module.
		db
			.select()
			.from(clockEntries)
			.where(and(eq(clockEntries.userId, userId), eq(clockEntries.date, todayStr()))),
		// Open tasks assigned to the viewer — personal by design, no admin-wide
		// variant here (the dashboard is "your" view of the day).
		db
			.select({ id: tasks.id })
			.from(tasks)
			.where(and(eq(tasks.assignedTo, userId), inArray(tasks.status, ['todo', 'in_progress']))),
		// Upcoming events this week — same visibility rule as the Calendar
		// module itself (creator, invitee, company-wide, same-department team,
		// or admin/superadmin sees everything).
		db
			.select({
				id: calendarEvents.id,
				title: calendarEvents.title,
				startTime: calendarEvents.startTime,
				visibility: calendarEvents.visibility,
				createdBy: calendarEvents.createdBy,
				creatorDepartment: users.department
			})
			.from(calendarEvents)
			.leftJoin(users, eq(calendarEvents.createdBy, users.id))
			.where(and(gte(calendarEvents.startTime, now), lte(calendarEvents.startTime, weekEnd)))
	]);
	const todayClockEntry = todayClockEntryRows[0] ?? null;

	const eventIds = eventRows.map((e) => e.id);
	const attendeeRows = eventIds.length
		? await db
				.select({ eventId: eventAttendees.eventId, userId: eventAttendees.userId })
				.from(eventAttendees)
				.where(inArray(eventAttendees.eventId, eventIds))
		: [];
	const invitedEventIds = new Set(attendeeRows.filter((a) => a.userId === userId).map((a) => a.eventId));

	const manager = isManager(role);
	const upcomingEvents = eventRows
		.filter((e) => {
			if (e.createdBy === userId) return true;
			if (manager) return true;
			if (invitedEventIds.has(e.id)) return true;
			if (e.visibility === 'company') return true;
			if (e.visibility === 'team' && department && e.creatorDepartment === department) return true;
			return false;
		})
		.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

	return {
		todayClockEntry,
		openTaskCount: openTasks.length,
		upcomingEvents: upcomingEvents.slice(0, 3),
		upcomingEventCount: upcomingEvents.length
	};
};
