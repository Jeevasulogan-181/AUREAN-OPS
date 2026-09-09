<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './[[folderId]]/$types';

	let { staffList, onclose }: { staffList: PageData['staffList']; onclose: () => void } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
	let shareCompany = $state(false);
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">New folder</h2>
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
			action="?/createFolder"
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
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-slate-700">Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
			</div>

			<div>
				<label class="flex items-center gap-2 text-sm text-slate-700">
					<input type="checkbox" name="shareCompany" bind:checked={shareCompany} />
					Share with entire company
				</label>
			</div>

			{#if !shareCompany}
				<div>
					<span class="mb-1 block text-sm font-medium text-slate-700">Or share with specific staff</span>
					<div class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
						{#each staffList as staffMember (staffMember.id)}
							<label class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
								<input type="checkbox" name="sharedWith" value={staffMember.id} />
								{staffMember.fullName}
							</label>
						{/each}
					</div>
				</div>
			{/if}

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
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{busy ? 'Creating…' : 'Create folder'}
				</button>
			</div>
		</form>
	</div>
</div>
