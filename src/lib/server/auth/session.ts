import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';

export const SESSION_COOKIE_NAME = 'session';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_THRESHOLD_MS = SESSION_DURATION_MS / 2;

export type AuthUser = {
	id: number;
	username: string;
	fullName: string;
	email: string;
	role: 'superadmin' | 'admin' | 'employee';
	department: string | null;
	isActive: boolean;
	mustResetPassword: boolean;
};

export type AuthSession = {
	id: string;
	userId: number;
	expiresAt: Date;
};

/** A cryptographically random token — this is what goes in the client's cookie. */
export function generateSessionToken(): string {
	return crypto.randomBytes(20).toString('base64url');
}

// The DB never stores the raw token, only its hash — mirrors the pattern from
// Lucia's session guide, so a leaked DB row can't be replayed as a cookie.
function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(token: string, userId: number): Promise<AuthSession> {
	const session: AuthSession = {
		id: hashToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
	};
	await db.insert(sessions).values(session);
	return session;
}

export async function validateSessionToken(
	token: string
): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
	const sessionId = hashToken(token);

	const rows = await db
		.select({
			session: sessions,
			user: {
				id: users.id,
				username: users.username,
				fullName: users.fullName,
				email: users.email,
				role: users.role,
				department: users.department,
				isActive: users.isActive,
				mustResetPassword: users.mustResetPassword
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));

	if (rows.length === 0) {
		return { session: null, user: null };
	}

	const { session, user } = rows[0];

	if (Date.now() >= session.expiresAt.getTime()) {
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}

	if (!user.isActive) {
		// Deactivated staff should be logged out immediately, even mid-session.
		await db.delete(sessions).where(eq(sessions.id, session.id));
		return { session: null, user: null };
	}

	// Sliding expiration: renew once the session is past its halfway point.
	if (Date.now() >= session.expiresAt.getTime() - SESSION_RENEW_THRESHOLD_MS) {
		session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await db.update(sessions).set({ expiresAt: session.expiresAt }).where(eq(sessions.id, session.id));
	}

	return { session, user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllUserSessions(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionTokenCookie(event: RequestEvent, token: string, expiresAt: Date): void {
	event.cookies.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		expires: expiresAt,
		path: '/'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.set(SESSION_COOKIE_NAME, '', {
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 0,
		path: '/'
	});
}
