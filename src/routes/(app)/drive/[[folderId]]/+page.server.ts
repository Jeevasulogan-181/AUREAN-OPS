import { eq, isNull } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { files, folders, users } from '$lib/server/db/schema';
import { deleteFile as deleteStoredFile, saveFile } from '$lib/server/fileStorage';
import { canManageFolder, canViewFolder, isManager, MAX_UPLOAD_BYTES } from '../shared';

async function loadFolderOr404(folderId: number) {
	const [folder] = await db.select().from(folders).where(eq(folders.id, folderId));
	if (!folder) {
		throw error(404, 'Folder not found');
	}
	return folder;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const user = locals.user;

	const folderId = params.folderId ? Number(params.folderId) : null;
	if (params.folderId && !folderId) {
		throw error(404, 'Folder not found');
	}

	let currentFolder: Awaited<ReturnType<typeof loadFolderOr404>> | null = null;
	const breadcrumb: { id: number; name: string }[] = [];

	if (folderId) {
		currentFolder = await loadFolderOr404(folderId);
		if (!canViewFolder(currentFolder, user)) {
			throw error(403, 'You do not have access to this folder');
		}

		// Walk up parentFolderId to build the breadcrumb trail.
		const chain = [currentFolder];
		let cursor = currentFolder;
		while (cursor.parentFolderId) {
			const [parent] = await db.select().from(folders).where(eq(folders.id, cursor.parentFolderId));
			if (!parent) break;
			chain.unshift(parent);
			cursor = parent;
		}
		breadcrumb.push(...chain.map((f) => ({ id: f.id, name: f.name })));
	}

	const subfolderRows = await db
		.select()
		.from(folders)
		.where(folderId ? eq(folders.parentFolderId, folderId) : isNull(folders.parentFolderId));

	// Column list explicitly excludes `content` — listing a folder should
	// never pull file bytes over the wire.
	const fileRows = await db
		.select({
			id: files.id,
			filename: files.filename,
			size: files.size,
			mimeType: files.mimeType,
			ownerId: files.ownerId,
			folderId: files.folderId,
			createdAt: files.createdAt,
			ownerName: users.fullName
		})
		.from(files)
		.leftJoin(users, eq(files.ownerId, users.id))
		.where(folderId ? eq(files.folderId, folderId) : isNull(files.folderId))
		.orderBy(files.filename);

	// `canManage` here only drives which buttons the UI shows — every action
	// below re-checks the same rule server-side before touching the DB.
	const visibleSubfolders = subfolderRows
		.filter((f) => canViewFolder(f, user))
		.map((f) => ({ ...f, canManage: canManageFolder(f, user) }));
	// Root-level files have no folder to inherit sharing from, so they're
	// owner-only (plus admin/superadmin) rather than following any share list.
	const visibleFiles = (folderId ? fileRows : fileRows.filter((f) => f.ownerId === user.id || isManager(user.role))).map(
		(f) => ({ ...f, canDelete: f.ownerId === user.id || isManager(user.role) })
	);

	const canManageHere = currentFolder ? canManageFolder(currentFolder, user) : true;

	const staffList = await db
		.select({ id: users.id, fullName: users.fullName })
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.fullName);

	return {
		folderId,
		currentFolder,
		breadcrumb,
		subfolders: visibleSubfolders,
		files: visibleFiles,
		canManageHere,
		staffList
	};
};

export const actions: Actions = {
	createFolder: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createFolder' as const, error: 'Not signed in' });
		}

		const parentFolderId = params.folderId ? Number(params.folderId) : null;
		if (parentFolderId) {
			const parent = await loadFolderOr404(parentFolderId);
			if (!canManageFolder(parent, locals.user)) {
				return fail(403, { intent: 'createFolder' as const, error: 'You cannot create a folder here' });
			}
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const shareCompany = formData.get('shareCompany') === 'on';
		const sharedUserIds = formData
			.getAll('sharedWith')
			.map((v) => Number(v))
			.filter((n) => Number.isInteger(n));

		if (!name) {
			return fail(400, { intent: 'createFolder' as const, error: 'Folder name is required' });
		}

		await db.insert(folders).values({
			name,
			parentFolderId,
			ownerId: locals.user.id,
			sharedWith: shareCompany ? ['company'] : sharedUserIds
		});

		return { intent: 'createFolder' as const, success: true };
	},

	uploadFile: async ({ request, locals, params }) => {
		if (!locals.user) {
			return fail(401, { intent: 'uploadFile' as const, error: 'Not signed in' });
		}

		const folderId = params.folderId ? Number(params.folderId) : null;
		if (folderId) {
			const folder = await loadFolderOr404(folderId);
			if (!canManageFolder(folder, locals.user)) {
				return fail(403, { intent: 'uploadFile' as const, error: 'You cannot upload here' });
			}
		}

		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { intent: 'uploadFile' as const, error: 'Choose a file to upload' });
		}
		if (file.size > MAX_UPLOAD_BYTES) {
			return fail(400, {
				intent: 'uploadFile' as const,
				error: `"${file.name}" is too large — the limit is 10MB for this prototype`
			});
		}

		const content = Buffer.from(await file.arrayBuffer());
		await saveFile({
			filename: file.name,
			mimeType: file.type || 'application/octet-stream',
			ownerId: locals.user.id,
			folderId,
			content
		});

		return { intent: 'uploadFile' as const, success: true };
	},

	deleteFile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteFile' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const fileId = Number(formData.get('fileId'));
		if (!fileId) {
			return fail(400, { intent: 'deleteFile' as const, error: 'Missing file' });
		}

		const [existing] = await db.select().from(files).where(eq(files.id, fileId));
		if (!existing) {
			return fail(404, { intent: 'deleteFile' as const, error: 'File not found' });
		}
		if (existing.ownerId !== locals.user.id && !isManager(locals.user.role)) {
			return fail(403, { intent: 'deleteFile' as const, error: 'You cannot delete this file' });
		}

		await deleteStoredFile(existing.storagePath);

		return { intent: 'deleteFile' as const, success: true };
	},

	deleteFolder: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'deleteFolder' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const folderId = Number(formData.get('folderId'));
		if (!folderId) {
			return fail(400, { intent: 'deleteFolder' as const, error: 'Missing folder' });
		}

		const existing = await loadFolderOr404(folderId);
		if (!canManageFolder(existing, locals.user)) {
			return fail(403, { intent: 'deleteFolder' as const, error: 'You cannot delete this folder' });
		}

		// Subfolders cascade-delete (folders.parentFolderId is ON DELETE
		// CASCADE); any files inside — at this level or deeper — move to their
		// owner's root instead of being deleted (files.folderId is ON DELETE
		// SET NULL), so nobody's uploads vanish just because a folder did.
		await db.delete(folders).where(eq(folders.id, folderId));

		throw redirect(302, existing.parentFolderId ? `/drive/${existing.parentFolderId}` : '/drive');
	}
};
