<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './[[channelId]]/$types';

	let { staffList, onclose }: { staffList: PageData['staffList']; onclose: () => void } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">New direct message</h2>
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
			action="?/createDm"
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
					// Same reasoning as NewChannelModal — success redirects
					// into a (possibly reused) channel page, so close explicitly.
					await update();
					onclose();
				};
			}}
		>
			<div>
				<label for="otherUserId" class="mb-1 block text-sm font-medium text-slate-700">Message</label>
				<select
					id="otherUserId"
					name="otherUserId"
					required
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				>
					<option value="" disabled selected>Choose someone…</option>
					{#each staffList as staffMember (staffMember.id)}
						<option value={staffMember.id}>{staffMember.fullName}</option>
					{/each}
				</select>
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
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{busy ? 'Starting…' : 'Start conversation'}
				</button>
			</div>
		</form>
	</div>
</div>
