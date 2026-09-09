<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type Task = PageData['tasks'][number];

	let {
		task = null,
		staffList,
		projectList,
		onclose
	}: {
		task?: Task | null;
		staffList: PageData['staffList'];
		projectList: PageData['projectList'];
		onclose: () => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	function toDateInputValue(value: Date | string | null): string {
		if (!value) return '';
		const d = value instanceof Date ? value : new Date(value);
		return d.toISOString().slice(0, 10);
	}
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-slate-900">{task ? 'Edit task' : 'New task'}</h2>
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
			action={task ? '?/updateTask' : '?/createTask'}
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
			{#if task}
				<input type="hidden" name="taskId" value={task.id} />
			{/if}

			<div>
				<label for="title" class="mb-1 block text-sm font-medium text-slate-700">Title</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					value={task?.title ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
			</div>

			<div>
				<label for="description" class="mb-1 block text-sm font-medium text-slate-700">Description</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					value={task?.description ?? ''}
					class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				></textarea>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="assignedTo" class="mb-1 block text-sm font-medium text-slate-700">Assignee</label>
					<select
						id="assignedTo"
						name="assignedTo"
						value={task?.assignedTo ?? ''}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						<option value="">Unassigned</option>
						{#each staffList as staffMember (staffMember.id)}
							<option value={staffMember.id}>{staffMember.fullName}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="projectId" class="mb-1 block text-sm font-medium text-slate-700">Project</label>
					<select
						id="projectId"
						name="projectId"
						value={task?.projectId ?? ''}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						<option value="">No project</option>
						{#each projectList as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="priority" class="mb-1 block text-sm font-medium text-slate-700">Priority</label>
					<select
						id="priority"
						name="priority"
						value={task?.priority ?? 'medium'}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						<option value="low">Low</option>
						<option value="medium">Medium</option>
						<option value="high">High</option>
						<option value="urgent">Urgent</option>
					</select>
				</div>
				<div>
					<label for="dueDate" class="mb-1 block text-sm font-medium text-slate-700">Due date</label>
					<input
						id="dueDate"
						name="dueDate"
						type="date"
						value={toDateInputValue(task?.dueDate ?? null)}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
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
					{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
				</button>
			</div>
		</form>
	</div>
</div>
