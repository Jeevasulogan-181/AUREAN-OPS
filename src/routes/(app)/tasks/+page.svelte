<script lang="ts">
	import { applyAction, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import TaskCard from './TaskCard.svelte';
	import TaskFormModal from './TaskFormModal.svelte';

	let { data }: { data: PageData } = $props();

	type Task = PageData['tasks'][number];

	let view = $state<'board' | 'list'>('board');
	let showCreate = $state(false);
	let editingTask = $state<Task | null>(null);
	let draggingId = $state<number | null>(null);
	let actionError = $state<string | null>(null);

	const COLUMNS = [
		{ status: 'todo' as const, label: 'To do' },
		{ status: 'in_progress' as const, label: 'In progress' },
		{ status: 'done' as const, label: 'Done' }
	];

	const grouped = $derived({
		todo: data.tasks.filter((t) => t.status === 'todo'),
		in_progress: data.tasks.filter((t) => t.status === 'in_progress'),
		done: data.tasks.filter((t) => t.status === 'done')
	});

	function canEditTask(task: Task): boolean {
		const role = data.user.role;
		return role === 'admin' || role === 'superadmin' || task.createdBy === data.user.id;
	}
	function canMoveTask(task: Task): boolean {
		return canEditTask(task) || task.assignedTo === data.user.id;
	}

	async function submitAction(action: string, fields: Record<string, string | number>) {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			body.set(key, String(value));
		}
		const response = await fetch(action, { method: 'POST', body });
		const result = deserialize(await response.text());
		if (result.type === 'failure') {
			actionError = (result.data?.error as string) ?? 'Something went wrong';
			return;
		}
		actionError = null;
		applyAction(result);
		await invalidateAll();
	}

	function onDragStart(event: DragEvent, taskId: number) {
		draggingId = taskId;
		event.dataTransfer?.setData('text/plain', String(taskId));
	}

	function onDrop(status: string) {
		if (draggingId == null) return;
		const task = data.tasks.find((t) => t.id === draggingId);
		draggingId = null;
		if (!task || task.status === status || !canMoveTask(task)) return;
		submitAction('?/updateStatus', { taskId: task.id, status });
	}

	function statusSelectChange(task: Task, event: Event) {
		const status = (event.target as HTMLSelectElement).value;
		submitAction('?/updateStatus', { taskId: task.id, status });
	}
</script>

<svelte:head>
	<title>Tasks — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Tasks</h1>
			<p class="mt-1 text-sm text-slate-500">Assign work, track priority and due dates.</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
				<button
					type="button"
					onclick={() => (view = 'board')}
					class="rounded-md px-3 py-1.5 font-medium transition {view === 'board'
						? 'bg-slate-900 text-white'
						: 'text-slate-600 hover:bg-slate-100'}"
				>
					Board
				</button>
				<button
					type="button"
					onclick={() => (view = 'list')}
					class="rounded-md px-3 py-1.5 font-medium transition {view === 'list'
						? 'bg-slate-900 text-white'
						: 'text-slate-600 hover:bg-slate-100'}"
				>
					List
				</button>
			</div>
			<button
				type="button"
				onclick={() => (showCreate = true)}
				class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
			>
				New task
			</button>
		</div>
	</div>

	{#if actionError}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{actionError}
		</div>
	{/if}

	{#if view === 'board'}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			{#each COLUMNS as column (column.status)}
				<div
					role="list"
					ondragover={(e) => e.preventDefault()}
					ondrop={() => onDrop(column.status)}
					class="rounded-xl border border-slate-200 bg-slate-100/60 p-3"
				>
					<div class="mb-3 flex items-center justify-between px-1">
						<h2 class="text-sm font-semibold text-slate-700">{column.label}</h2>
						<span class="text-xs text-slate-400">{grouped[column.status].length}</span>
					</div>
					<div class="space-y-2">
						{#each grouped[column.status] as task (task.id)}
							<TaskCard
								{task}
								canEdit={canEditTask(task)}
								canMove={canMoveTask(task)}
								ondragstart={onDragStart}
								onedit={(t) => (editingTask = t)}
							/>
						{:else}
							<p class="px-1 py-6 text-center text-xs text-slate-400">No tasks</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Title</th>
						<th class="px-4 py-3 font-medium">Project</th>
						<th class="px-4 py-3 font-medium">Assignee</th>
						<th class="px-4 py-3 font-medium">Priority</th>
						<th class="px-4 py-3 font-medium">Due</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.tasks as task (task.id)}
						<tr>
							<td class="px-4 py-3 font-medium text-slate-900">{task.title}</td>
							<td class="px-4 py-3 text-slate-600">{task.projectName ?? '—'}</td>
							<td class="px-4 py-3 text-slate-600">{task.assigneeName ?? 'Unassigned'}</td>
							<td class="px-4 py-3 text-slate-600">{task.priority}</td>
							<td class="px-4 py-3 text-slate-600">
								{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
							</td>
							<td class="px-4 py-3">
								<select
									value={task.status}
									disabled={!canMoveTask(task)}
									onchange={(e) => statusSelectChange(task, e)}
									class="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
								>
									<option value="todo">To do</option>
									<option value="in_progress">In progress</option>
									<option value="done">Done</option>
								</select>
							</td>
							<td class="px-4 py-3 text-right">
								{#if canEditTask(task)}
									<button
										type="button"
										onclick={() => (editingTask = task)}
										class="text-xs font-medium text-slate-500 hover:text-slate-900"
									>
										Edit
									</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="7" class="px-4 py-6 text-center text-slate-400">No tasks yet</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showCreate}
	<TaskFormModal
		staffList={data.staffList}
		projectList={data.projectList}
		onclose={() => (showCreate = false)}
	/>
{/if}

{#if editingTask}
	{#if canEditTask(editingTask)}
		<TaskFormModal
			task={editingTask}
			staffList={data.staffList}
			projectList={data.projectList}
			onclose={() => (editingTask = null)}
		/>
	{/if}
{/if}
