<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import ReminderFormModal from './ReminderFormModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type Reminder = PageData['reminders'][number];

	let showCreate = $state(false);
	let editingReminder = $state<Reminder | null>(null);
	let busyId = $state<number | null>(null);

	function fmt(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}

	function isOverdue(reminder: Reminder): boolean {
		if (reminder.isDone) return false;
		return new Date(reminder.remindAt).getTime() < Date.now();
	}

	function taskTitle(taskId: number | null): string | null {
		if (!taskId) return null;
		return data.myTasks.find((t) => t.id === taskId)?.title ?? null;
	}

	const pending = $derived(data.reminders.filter((r) => !r.isDone));
	const done = $derived(data.reminders.filter((r) => r.isDone));
</script>

<svelte:head>
	<title>Reminders — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Reminders</h1>
			<p class="mt-1 text-sm text-slate-500">Personal reminders, optionally linked to one of your tasks.</p>
		</div>
		<button
			type="button"
			onclick={() => (showCreate = true)}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
		>
			New reminder
		</button>
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="space-y-2">
		{#each pending as reminder (reminder.id)}
			<div
				class="flex items-start gap-3 rounded-xl border bg-white p-4 {isOverdue(reminder)
					? 'border-red-200'
					: 'border-slate-200'}"
			>
				<form
					method="POST"
					action="?/toggleDone"
					use:enhance={() => {
						busyId = reminder.id;
						return async ({ update }) => {
							await update();
							busyId = null;
						};
					}}
				>
					<input type="hidden" name="reminderId" value={reminder.id} />
					<button
						type="submit"
						disabled={busyId === reminder.id}
						aria-label="Mark done"
						class="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 transition hover:border-slate-900"
					></button>
				</form>

				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium text-slate-900">{reminder.title}</p>
					<p class="mt-0.5 text-xs {isOverdue(reminder) ? 'font-medium text-red-600' : 'text-slate-500'}">
						{fmt(reminder.remindAt)}{isOverdue(reminder) ? ' · overdue' : ''}
					</p>
					{#if taskTitle(reminder.relatedTaskId)}
						<p class="mt-1 text-xs text-slate-400">Linked to task: {taskTitle(reminder.relatedTaskId)}</p>
					{/if}
				</div>

				<div class="flex shrink-0 items-center gap-3">
					<button
						type="button"
						onclick={() => (editingReminder = reminder)}
						class="text-xs font-medium text-slate-500 hover:text-slate-900"
					>
						Edit
					</button>
					<form
						method="POST"
						action="?/deleteReminder"
						use:enhance={() => {
							busyId = reminder.id;
							return async ({ update }) => {
								await update();
								busyId = null;
							};
						}}
					>
						<input type="hidden" name="reminderId" value={reminder.id} />
						<button
							type="submit"
							disabled={busyId === reminder.id}
							class="text-xs font-medium text-slate-400 hover:text-red-600"
						>
							Delete
						</button>
					</form>
				</div>
			</div>
		{:else}
			<p class="py-12 text-center text-sm text-slate-400">No reminders — you're all caught up.</p>
		{/each}
	</div>

	{#if done.length > 0}
		<div class="mt-8">
			<h2 class="mb-2 text-sm font-semibold text-slate-500">Done</h2>
			<div class="space-y-2">
				{#each done as reminder (reminder.id)}
					<div class="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
						<form
							method="POST"
							action="?/toggleDone"
							use:enhance={() => {
								busyId = reminder.id;
								return async ({ update }) => {
									await update();
									busyId = null;
								};
							}}
						>
							<input type="hidden" name="reminderId" value={reminder.id} />
							<button
								type="submit"
								disabled={busyId === reminder.id}
								aria-label="Mark not done"
								class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white"
							>
								✓
							</button>
						</form>
						<div class="min-w-0 flex-1">
							<p class="text-sm text-slate-500 line-through">{reminder.title}</p>
							<p class="mt-0.5 text-xs text-slate-400">{fmt(reminder.remindAt)}</p>
						</div>
						<form
							method="POST"
							action="?/deleteReminder"
							use:enhance={() => {
								busyId = reminder.id;
								return async ({ update }) => {
									await update();
									busyId = null;
								};
							}}
						>
							<input type="hidden" name="reminderId" value={reminder.id} />
							<button
								type="submit"
								disabled={busyId === reminder.id}
								class="text-xs font-medium text-slate-400 hover:text-red-600"
							>
								Delete
							</button>
						</form>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if showCreate}
	<ReminderFormModal myTasks={data.myTasks} onclose={() => (showCreate = false)} />
{/if}

{#if editingReminder}
	<ReminderFormModal
		reminder={editingReminder}
		myTasks={data.myTasks}
		onclose={() => (editingReminder = null)}
	/>
{/if}
