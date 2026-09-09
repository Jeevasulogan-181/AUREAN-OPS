<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let {
		defaultDate,
		staffList,
		onclose
	}: {
		defaultDate: string;
		staffList: PageData['staffList'];
		onclose: () => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">New event</h2>
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
			action="?/createEvent"
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
				<label for="title" class="mb-1 block text-sm font-medium text-slate-700">Title</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
			</div>

			<div>
				<label for="description" class="mb-1 block text-sm font-medium text-slate-700">Description</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="startTime" class="mb-1 block text-sm font-medium text-slate-700">Start</label>
					<input
						id="startTime"
						name="startTime"
						type="datetime-local"
						required
						value={`${defaultDate}T09:00`}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="endTime" class="mb-1 block text-sm font-medium text-slate-700">End</label>
					<input
						id="endTime"
						name="endTime"
						type="datetime-local"
						required
						value={`${defaultDate}T10:00`}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
			</div>

			<div>
				<label for="visibility" class="mb-1 block text-sm font-medium text-slate-700">Visibility</label>
				<select
					id="visibility"
					name="visibility"
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				>
					<option value="private">Private — only you</option>
					<option value="team" selected>Team — your department</option>
					<option value="company">Company — everyone</option>
				</select>
			</div>

			<div>
				<span class="mb-1 block text-sm font-medium text-slate-700">Invite staff</span>
				<div class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
					{#each staffList as staffMember (staffMember.id)}
						<label class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
							<input type="checkbox" name="attendeeIds" value={staffMember.id} />
							{staffMember.fullName}
						</label>
					{/each}
				</div>
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
					{busy ? 'Creating…' : 'Create event'}
				</button>
			</div>
		</form>
	</div>
</div>
