<script lang="ts">
	import { enhance } from '$app/forms';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import type { ActionData, PageData } from './$types';
	import NoteFormModal from './NoteFormModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Note = PageData['notes'][number];

	let showCreate = $state(false);
	let editingNote = $state<Note | null>(null);
	let busyId = $state<number | null>(null);

	function fmt(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}

	function preview(content: string): string {
		const flat = content.replace(/\s+/g, ' ').trim();
		return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
	}
</script>

<svelte:head>
	<title>Notes — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Notes</h1>
			<p class="mt-1 text-sm text-slate-500">Your personal scratchpad — only you can see these.</p>
		</div>
		<button
			type="button"
			onclick={() => (showCreate = true)}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
		>
			New note
		</button>
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.notes as note (note.id)}
			<div class="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
				<div class="mb-2 flex items-start justify-between gap-2">
					<h2 class="font-semibold text-slate-900">{note.title}</h2>
				</div>
				{#if note.content}
					<p class="line-clamp-4 flex-1 text-sm whitespace-pre-line text-slate-600">{preview(note.content)}</p>
				{:else}
					<p class="flex-1 text-sm text-slate-400 italic">No content yet</p>
				{/if}
				<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
					<p class="text-xs text-slate-400">Edited {fmt(note.updatedAt)}</p>
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={() => (editingNote = note)}
							class="text-xs font-medium text-slate-500 hover:text-slate-900"
						>
							Edit
						</button>
						<form
							method="POST"
							action="?/deleteNote"
							use:enhance={() => {
								busyId = note.id;
								return async ({ update }) => {
									await update();
									busyId = null;
								};
							}}
						>
							<input type="hidden" name="noteId" value={note.id} />
							<button
								type="submit"
								disabled={busyId === note.id}
								class="text-xs font-medium text-slate-400 hover:text-red-600"
							>
								Delete
							</button>
						</form>
					</div>
				</div>
			</div>
		{:else}
			<div class="col-span-full flex flex-col items-center gap-3 py-16 text-center text-slate-400">
				<NotebookPen size={28} class="text-slate-300" />
				<p class="text-sm">No notes yet — create your first one.</p>
			</div>
		{/each}
	</div>
</div>

{#if showCreate}
	<NoteFormModal onclose={() => (showCreate = false)} />
{/if}

{#if editingNote}
	<NoteFormModal note={editingNote} onclose={() => (editingNote = null)} />
{/if}
