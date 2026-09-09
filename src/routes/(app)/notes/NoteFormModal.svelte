<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type Note = PageData['notes'][number];

	let {
		note = null,
		onclose
	}: {
		note?: Note | null;
		onclose: () => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">{note ? 'Edit note' : 'New note'}</h2>
			<button type="button" onclick={onclose} class="text-slate-400 hover:text-slate-600" aria-label="Close">
				✕
			</button>
		</div>

		{#if error}
			<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{error}
			</div>
		{/if}

		<form
			method="POST"
			action={note ? '?/updateNote' : '?/createNote'}
			class="space-y-4"
			use:enhance={() => {
				busy = true;
				error = null;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') {
						error = (result.data?.error as string) ?? 'Something went wrong';
						return;
					}
					await update();
					onclose();
				};
			}}
		>
			{#if note}
				<input type="hidden" name="noteId" value={note.id} />
			{/if}

			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-slate-700">Title</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					value={note?.title ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
				/>
			</div>

			<div>
				<label for="content" class="mb-1 block text-sm font-medium text-slate-700">Content</label>
				<textarea
					id="content"
					name="content"
					rows="10"
					value={note?.content ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
				></textarea>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onclick={onclose}
					class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={busy}
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
				>
					{busy ? 'Saving…' : note ? 'Save changes' : 'Create note'}
				</button>
			</div>
		</form>
	</div>
</div>
