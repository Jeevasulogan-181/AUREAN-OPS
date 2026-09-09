<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type Reminder = PageData['reminders'][number];

	let {
		reminder = null,
		myTasks,
		onclose
	}: {
		reminder?: Reminder | null;
		myTasks: PageData['myTasks'];
		onclose: () => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	function toDateTimeLocal(value: Date | string | null): string {
		if (!value) return '';
		const d = value instanceof Date ? value : new Date(value);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">{reminder ? 'Edit reminder' : 'New reminder'}</h2>
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
			action={reminder ? '?/updateReminder' : '?/createReminder'}
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
			{#if reminder}
				<input type="hidden" name="reminderId" value={reminder.id} />
			{/if}

			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-slate-700">Title</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					value={reminder?.title ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
			</div>

			<div>
				<label for="remindAt" class="mb-1 block text-sm font-medium text-slate-700">Remind at</label>
				<input
					id="remindAt"
					name="remindAt"
					type="datetime-local"
					required
					value={toDateTimeLocal(reminder?.remindAt ?? null)}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
			</div>

			<div>
				<label for="relatedTaskId" class="mb-1 block text-sm font-medium text-slate-700">Related task</label>
				<select
					id="relatedTaskId"
					name="relatedTaskId"
					value={reminder?.relatedTaskId ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				>
					<option value="">No related task</option>
					{#each myTasks as task (task.id)}
						<option value={task.id}>{task.title}</option>
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
					{busy ? 'Saving…' : reminder ? 'Save changes' : 'Create reminder'}
				</button>
			</div>
		</form>
	</div>
</div>
