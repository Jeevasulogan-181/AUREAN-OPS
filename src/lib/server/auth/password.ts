import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended baseline params for argon2id.
const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

export async function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
	return verify(hashedPassword, password, ARGON2_OPTIONS);
}

const TEMP_PASSWORD_WORDS = [
	'Amber',
	'Birch',
	'Cedar',
	'Coral',
	'Delta',
	'Ember',
	'Falcon',
	'Granite',
	'Harbor',
	'Indigo',
	'Juniper',
	'Lunar',
	'Nova',
	'Onyx',
	'Pixel',
	'Quartz',
	'Raven',
	'Sable',
	'Terra',
	'Umber',
	'Vivid',
	'Willow',
	'Yield',
	'Zephyr'
];

/**
 * A random, readable temporary password for newly-created employees
 * (e.g. "Harbor42-9f3a1c"). Shown to the admin exactly once — the user
 * is forced to set their own password on first login.
 */
export function generateTempPassword(): string {
	const word = TEMP_PASSWORD_WORDS[crypto.randomInt(0, TEMP_PASSWORD_WORDS.length)];
	const number = crypto.randomInt(10, 99);
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${word}${number}-${suffix}`;
}
