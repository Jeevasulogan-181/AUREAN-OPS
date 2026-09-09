<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showAddMember = $state(false);
	let showNewTask = $state(false);
	let busy = $state(false);

	const STATUS_STYLES: Record<string, string> = {
		active: 'bg-emerald-50 text-emerald-700',
		completed: 'bg-blue-50 text-blue-700',
		archived: 'bg-slate-100 text-slate-500'
	};
	const TASK_STATUS_LABELS: Record<string, string> = {
		todo: 'To do',
		in_progress: 'In progress',
		done: 'Done'
	};
</script>

<svelte:head>
	<title>{data.project.name} — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<a href="/projects" class="text-sm text-slate-500 hover:text-slate-700">← All projects</a>

	<div class="mt-2 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">{data.project.name}</h1>
			{#if data.project.description}
				<p class="mt-1 max-w-2xl text-sm text-slate-500">{data.project.description}</p>
			{/if}
		</div>

		{#if data.canManage}
			<form
				method="POST"
				action="?/updateStatus"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<select
					name="status"
					value={data.project.status}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
					class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
				>
					<option value="active">Active</option>
					<option value="completed">Completed</option>
					<option value="archived">Archived</option>
				</select>
			</form>
		{:else}
			<span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {STATUS_STYLES[data.project.status]}">
				{data.project.status}
			</span>
		{/if}
	</div>

	{#if form?.error}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-900">Tasks</h2>
				<button
					type="button"
					onclick={() => (showNewTask = true)}
					class="text-sm font-medium text-slate-600 hover:text-slate-900"
				>
					+ New task
				</button>
			</div>
			<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-2 font-medium">Title</th>
							<th class="px-4 py-2 font-medium">Assignee</th>
							<th class="px-4 py-2 font-medium">Priority</th>
							<th class="px-4 py-2 font-medium">Due</th>
							<th class="px-4 py-2 font-medium">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.projectTasks as task (task.id)}
							<tr>
								<td class="px-4 py-2 font-medium text-slate-900">{task.title}</td>
								<td class="px-4 py-2 text-slate-600">{task.assigneeName ?? 'Unassigned'}</td>
								<td class="px-4 py-2 text-slate-600">{task.priority}</td>
								<td class="px-4 py-2 text-slate-600">
									{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
								</td>
								<td class="px-4 py-2 text-slate-600">{TASK_STATUS_LABELS[task.status]}</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-4 py-6 text-center text-slate-400">No tasks in this project yet</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-2 text-xs text-slate-400">
				Manage status, assignee, and priority from the <a href="/tasks" class="underline">Tasks board</a>.
			</p>
		</div>

		<div>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-900">Team</h2>
				{#if data.canManage}
					<button
						type="button"
						onclick={() => (showAddMember = true)}
						class="text-sm font-medium text-slate-600 hover:text-slate-900"
					>
						+ Add
					</button>
				{/if}
			</div>
			<div class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
				{#each data.members as member (member.userId)}
					<div class="flex items-center justify-between px-4 py-3">
						<div>
							<p class="text-sm font-medium text-slate-900">{member.fullName}</p>
							<p class="text-xs text-slate-400">{member.roleInProject}</p>
						</div>
						{#if data.canManage && member.userId !== data.project.ownerId}
							<form
								method="POST"
								action="?/removeMember"
								use:enhance={() => {
									busy = true;
									return async ({ update }) => {
										await update();
										busy = false;
									};
								}}
							>
								<input type="hidden" name="userId" value={member.userId} />
								<button
									type="submit"
									disabled={busy}
									class="text-xs font-medium text-slate-400 hover:text-red-600"
								>
									Remove
								</button>
							</form>
						{/if}
					</div>
				{:else}
					<p class="px-4 py-6 text-center text-sm text-slate-400">No members yet</p>
				{/each}
			</div>
		</div>
	</div>
</div>

{#if showAddMember}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-900">Add member</h2>
				<button
					type="button"
					onclick={() => (showAddMember = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<form
				method="POST"
				action="?/addMember"
				class="space-y-4"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
						showAddMember = false;
					};
				}}
			>
				<div>
					<label for="userId" class="mb-1 block text-sm font-medium text-slate-700">Employee</label>
					<select
						id="userId"
						name="userId"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						{#each data.availableStaff as staffMember (staffMember.id)}
							<option value={staffMember.id}>{staffMember.fullName}</option>
						{:else}
							<option disabled>Everyone is already a member</option>
						{/each}
					</select>
				</div>
				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showAddMember = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={busy || data.availableStaff.length === 0}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						Add
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showNewTask}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-900">New task in {data.project.name}</h2>
				<button
					type="button"
					onclick={() => (showNewTask = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<form
				method="POST"
				action="?/createTask"
				class="space-y-4"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
						showNewTask = false;
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
					<label for="assignedTo" class="mb-1 block text-sm font-medium text-slate-700">Assignee</label>
					<select
						id="assignedTo"
						name="assignedTo"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						<option value="">Unassigned</option>
						{#each data.members as member (member.userId)}
							<option value={member.userId}>{member.fullName}</option>
						{/each}
					</select>
				</div>
				<p class="text-xs text-slate-500">
					Set priority and due date afterward from the <a href="/tasks" class="underline">Tasks board</a>.
				</p>
				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showNewTask = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={busy}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						Create
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
