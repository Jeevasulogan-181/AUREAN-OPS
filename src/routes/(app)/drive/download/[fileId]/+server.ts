import { eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { files, folders } from '$lib/server/db/schema';
import { getFile } from '$lib/server/fileStorage';
import { canAccessFile } from '../../shared';

function contentDisposition(filename: string): string {
	// ASCII-safe fallback plus the RFC 5987 form for everything else.
	const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const fileId = Number(params.fileId);
	if (!fileId) {
		throw error(404, 'File not found');
	}

	const [fileRow] = await db.select().from(files).where(eq(files.id, fileId));
	if (!fileRow) {
		throw error(404, 'File not found');
	}

	let folder = null;
	if (fileRow.folderId) {
		[folder] = await db.select().from(folders).where(eq(folders.id, fileRow.folderId));
	}

	if (!canAccessFile(fileRow, folder, locals.user)) {
		throw error(403, 'You do not have access to this file');
	}

	const stored = await getFile(fileRow.storagePath);
	if (!stored) {
		throw error(404, 'File content not found');
	}

	// Node's Buffer type and lib.dom's BodyInit disagree on the ArrayBufferLike
	// generic even though a Buffer is a real Uint8Array at runtime — safe cast.
	return new Response(stored.content as unknown as BodyInit, {
		headers: {
			'Content-Type': stored.mimeType || 'application/octet-stream',
			'Content-Disposition': contentDisposition(stored.filename),
			'Content-Length': String(stored.size)
		}
	});
};
