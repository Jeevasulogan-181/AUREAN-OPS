import { promisify } from 'node:util';
import libre from 'libreoffice-convert';

// Wraps headless LibreOffice via child_process (see the libreoffice-convert
// package). This requires a LibreOffice install on whatever machine runs the
// server — see the README setup note. There's no queue here: conversion runs
// synchronously in the request that uploaded the file, which is fine for a
// prototype's expected volume but will block the event loop briefly for
// larger documents.

const convertAsync = promisify(libre.convert);

const CONVERT_TIMEOUT_MS = 60_000;

export class ConversionError extends Error {}

export async function convertDocxToPdf(input: Buffer): Promise<Buffer> {
	const timeout = new Promise<never>((_, reject) => {
		setTimeout(
			() => reject(new ConversionError('Conversion timed out — is LibreOffice installed and responding?')),
			CONVERT_TIMEOUT_MS
		);
	});

	try {
		return await Promise.race([convertAsync(input, '.pdf', undefined), timeout]);
	} catch (err) {
		if (err instanceof ConversionError) throw err;
		const message = err instanceof Error ? err.message : String(err);
		throw new ConversionError(`Conversion failed: ${message}`);
	}
}
