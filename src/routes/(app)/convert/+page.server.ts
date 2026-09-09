import { desc, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { docConversions } from '$lib/server/db/schema';
import { saveFile } from '$lib/server/fileStorage';
import { ConversionError, convertDocxToPdf } from '$lib/server/convertDocument';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, same prototype limit as Drive.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const history = await db
		.select()
		.from(docConversions)
		.where(eq(docConversions.userId, locals.user.id))
		.orderBy(desc(docConversions.createdAt));

	return { history };
};

export const actions: Actions = {
	convertFile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Not signed in' });
		}

		const formData = await request.formData();
		const file = formData.get('file');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a .docx file to convert' });
		}
		if (!file.name.toLowerCase().endsWith('.docx')) {
			return fail(400, { error: 'Only .docx files are supported right now' });
		}
		if (file.size > MAX_UPLOAD_BYTES) {
			return fail(400, { error: `"${file.name}" is too large — the limit is 10MB for this prototype` });
		}

		const [conversion] = await db
			.insert(docConversions)
			.values({
				userId: locals.user.id,
				originalFilename: file.name,
				originalType: file.type || DOCX_MIME,
				convertedType: 'application/pdf',
				status: 'processing'
			})
			.returning({ id: docConversions.id });

		try {
			const inputBuffer = Buffer.from(await file.arrayBuffer());
			const pdfBuffer = await convertDocxToPdf(inputBuffer);

			const pdfFilename = file.name.replace(/\.docx$/i, '.pdf');
			const { fileId } = await saveFile({
				filename: pdfFilename,
				mimeType: 'application/pdf',
				ownerId: locals.user.id,
				folderId: null,
				content: pdfBuffer
			});

			await db
				.update(docConversions)
				.set({ status: 'completed', storagePath: String(fileId) })
				.where(eq(docConversions.id, conversion.id));

			return { success: true as const };
		} catch (err) {
			await db.update(docConversions).set({ status: 'failed' }).where(eq(docConversions.id, conversion.id));

			const message =
				err instanceof ConversionError
					? err.message
					: 'Conversion failed unexpectedly. Please try again or contact an admin.';
			return fail(500, { error: message });
		}
	}
};
