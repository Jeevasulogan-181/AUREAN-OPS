import type { AuthUser } from '$lib/server/auth/session';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — see README for why.

export function isManager(role: string): boolean {
	return role === 'admin' || role === 'superadmin';
}

type SharableFolder = {
	ownerId: number;
	sharedWith: (number | 'company')[];
};

/**
 * Visibility rule for a folder: its owner, anyone admin/superadmin (for
 * oversight, same pattern as Tasks/Projects), anyone listed in `sharedWith`,
 * or everyone if `sharedWith` contains the literal "company".
 */
export function canViewFolder(folder: SharableFolder, user: AuthUser): boolean {
	if (folder.ownerId === user.id) return true;
	if (isManager(user.role)) return true;
	if (folder.sharedWith.includes('company')) return true;
	if (folder.sharedWith.includes(user.id)) return true;
	return false;
}

/**
 * Write access (upload into / create subfolders in / delete from a folder) is
 * narrower than view access: sharing only ever grants read access here, so
 * only the owner or an admin/superadmin can write.
 */
export function canManageFolder(folder: { ownerId: number }, user: AuthUser): boolean {
	return folder.ownerId === user.id || isManager(user.role);
}

/** A root-level file (no folder) has no sharing concept — owner-only. */
export function canAccessFile(
	file: { ownerId: number; folderId: number | null },
	folder: SharableFolder | null,
	user: AuthUser
): boolean {
	if (file.ownerId === user.id) return true;
	if (isManager(user.role)) return true;
	if (file.folderId && folder) return canViewFolder(folder, user);
	return false;
}
