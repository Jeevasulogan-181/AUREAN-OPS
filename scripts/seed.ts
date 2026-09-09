import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { hash } from '@node-rs/argon2';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { users } from '../src/lib/server/db/schema';

// Kept in sync with src/lib/server/auth/password.ts's ARGON2_OPTIONS.
// (This script runs standalone via tsx, outside the SvelteKit module graph,
// so it can't import $lib — duplicating the constant is simpler than wiring
// path aliases for a one-off script.)
const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

async function main() {
	const { DATABASE_URL, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD, SUPERADMIN_EMAIL } = process.env;

	if (!DATABASE_URL) {
		throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
	}
	if (!SUPERADMIN_USERNAME || !SUPERADMIN_PASSWORD || !SUPERADMIN_EMAIL) {
		throw new Error(
			'SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD, and SUPERADMIN_EMAIL must all be set in .env'
		);
	}
	if (SUPERADMIN_PASSWORD.length < 8) {
		throw new Error('SUPERADMIN_PASSWORD must be at least 8 characters.');
	}

	const sql = neon(DATABASE_URL);
	const db = drizzle(sql);

	const username = SUPERADMIN_USERNAME.trim().toLowerCase();

	const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
	if (existing.length > 0) {
		console.log(`User "${username}" already exists — skipping seed.`);
		return;
	}

	const passwordHash = await hash(SUPERADMIN_PASSWORD, ARGON2_OPTIONS);

	await db.insert(users).values({
		username,
		passwordHash,
		fullName: 'Super Admin',
		email: SUPERADMIN_EMAIL.trim().toLowerCase(),
		role: 'superadmin',
		department: null,
		isActive: true,
		// The superadmin sets their own real password via env vars up front,
		// so there's no temp password to force a reset on.
		mustResetPassword: false
	});

	console.log(`Superadmin "${username}" created. You can log in now.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	});
