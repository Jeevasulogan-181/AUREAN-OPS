import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { clockEntries, users } from '$lib/server/db/schema';

// clock_entries.date is a plain "YYYY-MM-DD" column — we key everything off
// UTC calendar days rather than the viewer's local timezone, since this is a
// single-office internal tool and it keeps "today" unambiguous server-side.
function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const { id: userId, role } = locals.user;
	const today = todayStr();

	const [todayEntry] = await db
		.select()
		.from(clockEntries)
		.where(and(eq(clockEntries.userId, userId), eq(clockEntries.date, today)));

	const myHistory = await db
		.select()
		.from(clockEntries)
		.where(eq(clockEntries.userId, userId))
		.orderBy(desc(clockEntries.date))
		.limit(30);

	if (!isManager(role)) {
		return { todayEntry: todayEntry ?? null, myHistory, manager: false as const };
	}

	// Manager/admin also gets the all-staff, filterable history view.
	const from = url.searchParams.get('from') || today;
	const to = url.searchParams.get('to') || today;
	const employeeIdParam = url.searchParams.get('employeeId');
	const employeeId = employeeIdParam ? Number(employeeIdParam) : null;

	const staffList = await db
		.select({ id: users.id, fullName: users.fullName })
		.from(users)
		.orderBy(users.fullName);

	const conditions = [gte(clockEntries.date, from), lte(clockEntries.date, to)];
	if (employeeId) conditions.push(eq(clockEntries.userId, employeeId));

	const teamHistory = await db
		.select({
			id: clockEntries.id,
			userId: clockEntries.userId,
			fullName: users.fullName,
			clockIn: clockEntries.clockIn,
			clockOut: clockEntries.clockOut,
			notes: clockEntries.notes,
			date: clockEntries.date
		})
		.from(clockEntries)
		.innerJoin(users, eq(clockEntries.userId, users.id))
		.where(and(...conditions))
		.orderBy(desc(clockEntries.date), users.fullName);

	return {
		todayEntry: todayEntry ?? null,
		myHistory,
		manager: true as const,
		staffList,
		teamHistory,
		filters: { from, to, employeeId }
	};
};

export const actions: Actions = {
	clockIn: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not signed in' });
		}
		const userId = locals.user.id;
		const today = todayStr();

		const [existing] = await db
			.select()
			.from(clockEntries)
			.where(and(eq(clockEntries.userId, userId), eq(clockEntries.date, today)));

		if (existing) {
			return fail(400, { error: 'You have already clocked in today' });
		}

		await db.insert(clockEntries).values({
			userId,
			clockIn: new Date(),
			date: today
		});

		return { success: true as const };
	},

	clockOut: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not signed in' });
		}
		const userId = locals.user.id;
		const today = todayStr();

		const [existing] = await db
			.select()
			.from(clockEntries)
			.where(and(eq(clockEntries.userId, userId), eq(clockEntries.date, today)));

		if (!existing) {
			return fail(400, { error: 'You have not clocked in today' });
		}
		if (existing.clockOut) {
			return fail(400, { error: 'You have already clocked out today' });
		}

		await db.update(clockEntries).set({ clockOut: new Date() }).where(eq(clockEntries.id, existing.id));

		return { success: true as const };
	}
};
