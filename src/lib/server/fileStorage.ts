import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';

/**
 * File storage abstraction.
 *
 * Backing store today: the `files.content` bytea column in Neon Postgres —
 * fine for a prototype at low volume, at the cost of loading whole files
 * into memory and growing the Postgres data size. Every caller (Drive routes,
 * the Word→PDF converter) only ever sees a `storagePath` string; swapping to
 * Vercel Blob/R2/S3 later means rewriting this module only, not the routes
 * that call it.
 */

export interface SaveFileInput {
	filename: string;
	mimeType: string;
	ownerId: number;
	folderId?: number | null;
	content: Buffer;
}

export interface SavedFile {
	fileId: number;
	storagePath: string;
}

export interface StoredFile {
	filename: string;
	mimeType: string;
	size: number;
	content: Buffer;
}

export async function saveFile(input: SaveFileInput): Promise<SavedFile> {
	const storagePath = `pg:${crypto.randomUUID()}`;

	const [row] = await db
		.insert(files)
		.values({
			ownerId: input.ownerId,
			filename: input.filename,
			mimeType: input.mimeType,
			size: input.content.length,
			folderId: input.folderId ?? null,
			storagePath,
			content: input.content
		})
		.returning({ id: files.id });

	return { fileId: row.id, storagePath };
}

export async function getFile(storagePath: string): Promise<StoredFile | null> {
	const [row] = await db
		.select({
			filename: files.filename,
			mimeType: files.mimeType,
			size: files.size,
			content: files.content
		})
		.from(files)
		.where(eq(files.storagePath, storagePath));

	return row ?? null;
}

export async function deleteFile(storagePath: string): Promise<void> {
	await db.delete(files).where(eq(files.storagePath, storagePath));
}
