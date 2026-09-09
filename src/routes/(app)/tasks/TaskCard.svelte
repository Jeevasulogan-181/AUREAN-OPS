<script lang="ts">
	import type { PageData } from './$types';

	type Task = PageData['tasks'][number];

	let {
		task,
		canEdit,
		canMove,
		ondragstart,
		onedit
	}: {
		task: Task;
		canEdit: boolean;
		canMove: boolean;
		ondragstart: (event: DragEvent, taskId: number) => void;
		onedit: (task: Task) => void;
	} = $props();

	const PRIORITY_STYLES: Record<string, string> = {
		low: 'bg-slate-100 text-slate-600',
		medium: 'bg-blue-50 text-blue-700',
		high: 'bg-amber-50 text-amber-700',
		urgent: 'bg-red-50 text-red-700'
	};

	const isOverdue = $derived(
		task.dueDate != null && task.status !== 'done' && new Date(task.dueDate).getTime() < Date.now()
	);
</script>

<div
	role="listitem"
	draggable={canMove}
	ondragstart={(e) => ondragstart(e, task.id)}
	class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition {canMove
		? 'cursor-grab active:cursor-grabbing'
		: ''}"
>
	<div class="flex items-start justify-between gap-2">
		<p class="text-sm font-medium text-slate-900">{task.title}</p>
		<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold {PRIORITY_STYLES[task.priority]}">
			{task.priority}
		</span>
	</div>

	{#if task.description}
		<p class="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
	{/if}

	{#if task.projectName}
		<p class="mt-2 text-[11px] font-medium text-slate-400">{task.projectName}</p>
	{/if}

	<div class="mt-2 flex items-center justify-between text-xs text-slate-500">
		<span>{task.assigneeName ?? 'Unassigned'}</span>
		{#if task.dueDate}
			<span class={isOverdue ? 'font-medium text-red-600' : ''}>
				{new Date(task.dueDate).toLocaleDateString()}
			</span>
		{/if}
	</div>

	{#if canEdit}
		<button
			type="button"
			onclick={() => onedit(task)}
			class="mt-2 text-xs font-medium text-slate-500 hover:text-slate-900"
		>
			Edit
		</button>
	{/if}
</div>
