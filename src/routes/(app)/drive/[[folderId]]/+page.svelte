<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import NewFolderModal from '../NewFolderModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showNewFolder = $state(false);
	let uploading = $state(false);
	let busyId = $state<number | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function fmtDate(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleDateString();
	}
</script>

<svelte:head>
	<title>Drive — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Drive</h1>
			<nav class="mt-1 flex items-center gap-1 text-sm text-slate-500">
				<a href="/drive" class="hover:text-slate-900 hover:underline">Drive</a>
				{#each data.breadcrumb as crumb, i (crumb.id)}
					<span>/</span>
					{#if i === data.breadcrumb.length - 1}
						<span class="font-medium text-slate-700">{crumb.name}</span>
					{:else}
						<a href="/drive/{crumb.id}" class="hover:text-slate-900 hover:underline">{crumb.name}</a>
					{/if}
				{/each}
			</nav>
		</div>
		{#if data.canManageHere}
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (showNewFolder = true)}
					class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
				>
					New folder
				</button>
				<form
					method="POST"
					action="?/uploadFile"
					enctype="multipart/form-data"
					use:enhance={() => {
						uploading = true;
						return async ({ update }) => {
							await update();
							uploading = false;
							if (fileInput) fileInput.value = '';
						};
					}}
				>
					<input
						bind:this={fileInput}
						type="file"
						name="file"
						required
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
						class="hidden"
						id="file-upload"
					/>
					<label
						for="file-upload"
						class="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 {uploading
							? 'pointer-events-none opacity-50'
							: ''}"
					>
						{uploading ? 'Uploading…' : 'Upload file'}
					</label>
				</form>
			</div>
		{/if}
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
				<tr>
					<th class="px-4 py-2 font-medium">Name</th>
					<th class="px-4 py-2 font-medium">Owner</th>
					<th class="px-4 py-2 font-medium">Size</th>
					<th class="px-4 py-2 font-medium">Added</th>
					<th class="px-4 py-2 font-medium"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.subfolders as folder (folder.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-2">
							<a href="/drive/{folder.id}" class="flex items-center gap-2 font-medium text-slate-900 hover:underline">
								📁 {folder.name}
							</a>
						</td>
						<td class="px-4 py-2 text-slate-400">—</td>
						<td class="px-4 py-2 text-slate-400">—</td>
						<td class="px-4 py-2 text-slate-400">—</td>
						<td class="px-4 py-2 text-right">
							{#if folder.canManage}
								<form
									method="POST"
									action="?/deleteFolder"
									use:enhance={() => {
										busyId = folder.id;
										return async ({ update }) => {
											await update();
											busyId = null;
										};
									}}
								>
									<input type="hidden" name="folderId" value={folder.id} />
									<button
										type="submit"
										disabled={busyId === folder.id}
										class="text-xs font-medium text-slate-400 hover:text-red-600"
									>
										Delete
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
				{#each data.files as file (file.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-2">
							<a
								href="/drive/download/{file.id}"
								data-sveltekit-reload
								class="flex items-center gap-2 font-medium text-slate-900 hover:underline"
							>
								📄 {file.filename}
							</a>
						</td>
						<td class="px-4 py-2 text-slate-500">{file.ownerName ?? '—'}</td>
						<td class="px-4 py-2 text-slate-500">{formatSize(file.size)}</td>
						<td class="px-4 py-2 text-slate-500">{fmtDate(file.createdAt)}</td>
						<td class="px-4 py-2 text-right">
							{#if file.canDelete}
								<form
									method="POST"
									action="?/deleteFile"
									use:enhance={() => {
										busyId = file.id;
										return async ({ update }) => {
											await update();
											busyId = null;
										};
									}}
								>
									<input type="hidden" name="fileId" value={file.id} />
									<button
										type="submit"
										disabled={busyId === file.id}
										class="text-xs font-medium text-slate-400 hover:text-red-600"
									>
										Delete
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
				{#if data.subfolders.length === 0 && data.files.length === 0}
					<tr>
						<td colspan="5" class="px-4 py-12 text-center text-slate-400">This folder is empty</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

{#if showNewFolder}
	<NewFolderModal staffList={data.staffList} onclose={() => (showNewFolder = false)} />
{/if}
