import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { calendarEvents, eventAttendees, users } from '$lib/server/db/schema';

const VISIBILITIES = ['private', 'team', 'company'] as const;
type Visibility = (typeof VISIBILITIES)[number];

const ATTENDEE_STATUSES = ['invited', 'accepted', 'declined'] as const;
type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number];

function isVisibility(value: unknown): value is Visibility {
	return typeof value === 'string' && (VISIBILITIES as readonly string[]).includes(value);
}
function isAttendeeStatus(value: unknown): value is AttendeeStatus {
	return typeof value === 'string' && (ATTENDEE_STATUSES as readonly string[]).includes(value);
}
function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

// Calendar days are bucketed by UTC calendar date, same simplification as the
// clock-in/out module — fine for a single-office internal tool.
function parseMonthParam(raw: string | null): { year: number; month: number } {
	if (raw && /^\d{4}-\d{2}$/.test(raw)) {
		const [year, month] = raw.split('-').map(Number);
		if (month >= 1 && month <= 12) return { year, month };
	}
	const now = new Date();
	return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function parseDateTimeLocal(raw: FormDataEntryValue | null): Date | null {
	const str = String(raw ?? '').trim();
	if (!str) return null;
	const d = new Date(str);
	return Number.isNaN(d.getTime()) ? null : d;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { year, month } = parseMonthParam(url.searchParams.get('month'));
	const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
	const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

	const rows = await db
		.select({
			id: calendarEvents.id,
			title: calendarEvents.title,
			description: calendarEvents.description,
			startTime: calendarEvents.startTime,
			endTime: calendarEvents.endTime,
			visibility: calendarEvents.visibility,
			createdBy: calendarEvents.createdBy,
			creatorName: users.fullName,
			creatorDepartment: users.department
		})
		.from(calendarEvents)
		.leftJoin(users, eq(calendarEvents.createdBy, users.id))
		.where(and(lte(calendarEvents.startTime, monthEnd), gte(calendarEvents.endTime, monthStart)));

	const eventIds = rows.map((r) => r.id);
	const attendeeRows = eventIds.length
		? await db
				.select({
					eventId: eventAttendees.eventId,
					userId: eventAttendees.userId,
					status: eventAttendees.status,
					fullName: users.fullName
				})
				.from(eventAttendees)
				.innerJoin(users, eq(eventAttendees.userId, users.id))
				.where(inArray(eventAttendees.eventId, eventIds))
		: [];

	const attendeesByEvent = new Map<number, typeof attendeeRows>();
	for (const a of attendeeRows) {
		const list = attendeesByEvent.get(a.eventId) ?? [];
		list.push(a);
		attendeesByEvent.set(a.eventId, list);
	}

	const { id: userId, role, department } = locals.user;
	const manager = isManager(role);

	const events = rows
		.map((e) => {
			const attendees = attendeesByEvent.get(e.id) ?? [];
			return { ...e, attendees, myStatus: attendees.find((a) => a.userId === userId)?.status ?? null };
		})
		.filter((e) => {
			if (e.createdBy === userId) return true;
			if (manager) return true;
			if (e.myStatus !== null) return true; // invited, regardless of visibility
			if (e.visibility === 'company') return true;
			if (e.visibility === 'team' && department && e.creatorDepartment === department) return true;
			return false;
		});

	const staffList = await db
		.select({ id: users.id, fullName: users.fullName })
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.fullName);

	return {
		events,
		staffList,
		month: { year, month, label: monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
	};
};

export const actions: Actions = {
	createEvent: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createEvent' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const title = String(formData.get('title') ?? '').trim();
		const description = String(formData.get('description') ?? '').trim() || null;
		const startTime = parseDateTimeLocal(formData.get('startTime'));
		const endTime = parseDateTimeLocal(formData.get('endTime'));
		const visibility = formData.get('visibility');
		const attendeeIds = formData
			.getAll('attendeeIds')
			.map((v) => Number(v))
			.filter((n) => Number.isInteger(n) && n !== locals.user!.id);

		if (!title) {
			return fail(400, { intent: 'createEvent' as const, error: 'Title is required' });
		}
		if (!startTime || !endTime) {
			return fail(400, { intent: 'createEvent' as const, error: 'Start and end time are required' });
		}
		if (endTime.getTime() < startTime.getTime()) {
			return fail(400, { intent: 'createEvent' as const, error: 'End time must be after start time' });
		}
		if (!isVisibility(visibility)) {
			return fail(400, { intent: 'createEvent' as const, error: 'Invalid visibility' });
		}

		const [created] = await db
			.insert(calendarEvents)
			.values({ title, description, startTime, endTime, visibility, createdBy: locals.user.id })
			.returning({ id: calendarEvents.id });

		if (attendeeIds.length > 0) {
			await db
				.insert(eventAttendees)
				.values(attendeeIds.map((userId) => ({ eventId: created.id, userId })))
				.onConflictDoNothing();
		}

		return { intent: 'createEvent' as const, success: true };
	},

	respondAttendance: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'respondAttendance' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const eventId = Number(formData.get('eventId'));
		const status = formData.get('status');

		if (!eventId || !isAttendeeStatus(status) || status === 'invited') {
			return fail(400, { intent: 'respondAttendance' as const, error: 'Invalid response' });
		}

		const [existing] = await db
			.select()
			.from(eventAttendees)
			.where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, locals.user.id)));
		if (!existing) {
			return fail(403, { intent: 'respondAttendance' as const, error: 'You were not invited to this event' });
		}

		await db
			.update(eventAttendees)
			.set({ status })
			.where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, locals.user.id)));

		return { intent: 'respondAttendance' as const, success: true };
	},

	deleteEvent: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteEvent' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const eventId = Number(formData.get('eventId'));
		if (!eventId) {
			return fail(400, { intent: 'deleteEvent' as const, error: 'Missing event' });
		}

		const [existing] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId));
		if (!existing) {
			return fail(404, { intent: 'deleteEvent' as const, error: 'Event not found' });
		}
		if (existing.createdBy !== locals.user.id && !isManager(locals.user.role)) {
			return fail(403, { intent: 'deleteEvent' as const, error: 'You cannot delete this event' });
		}

		await db.delete(calendarEvents).where(eq(calendarEvents.id, eventId));

		return { intent: 'deleteEvent' as const, success: true };
	}
};
