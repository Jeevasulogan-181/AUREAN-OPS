<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let converting = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	function fmt(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}

	const STATUS_STYLES: Record<string, string> = {
		pending: 'bg-slate-100 text-slate-500',
		processing: 'bg-blue-50 text-blue-700',
		completed: 'bg-emerald-50 text-emerald-700',
		failed: 'bg-red-50 text-red-700'
	};
</script>

<svelte:head>
	<title>Word → PDF — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<h1 class="text-2xl font-semibold text-slate-900">Word → PDF</h1>
	<p class="mt-1 text-sm text-slate-500">Upload a .docx file and convert it to PDF.</p>

	{#if form?.error}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6">
		<form
			method="POST"
			action="?/convertFile"
			enctype="multipart/form-data"
			use:enhance={() => {
				converting = true;
				return async ({ update }) => {
					await update();
					converting = false;
					if (fileInput) fileInput.value = '';
				};
			}}
		>
			<label for="file" class="mb-1 block text-sm font-medium text-slate-700">.docx file</label>
			<input
				bind:this={fileInput}
				id="file"
				name="file"
				type="file"
				accept=".docx"
				required
				class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
			/>
			<button
				type="submit"
				disabled={converting}
				class="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
			>
				{converting ? 'Converting… this can take a moment' : 'Convert to PDF'}
			</button>
		</form>
	</div>

	<div class="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
		<div class="border-b border-slate-200 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">Your conversion history</h2>
		</div>
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
				<tr>
					<th class="px-4 py-2 font-medium">File</th>
					<th class="px-4 py-2 font-medium">Status</th>
					<th class="px-4 py-2 font-medium">Date</th>
					<th class="px-4 py-2 font-medium"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.history as conversion (conversion.id)}
					<tr>
						<td class="px-4 py-2 font-medium text-slate-900">{conversion.originalFilename}</td>
						<td class="px-4 py-2">
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {STATUS_STYLES[conversion.status]}">
								{conversion.status}
							</span>
						</td>
						<td class="px-4 py-2 text-slate-500">{fmt(conversion.createdAt)}</td>
						<td class="px-4 py-2 text-right">
							{#if conversion.status === 'completed' && conversion.storagePath}
								<a
									href="/drive/download/{conversion.storagePath}"
									data-sveltekit-reload
									class="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
								>
									Download PDF
								</a>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="px-4 py-6 text-center text-slate-400">No conversions yet</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
