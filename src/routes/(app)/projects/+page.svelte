<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let creating = $state(false);

	const STATUS_STYLES: Record<string, string> = {
		active: 'bg-emerald-50 text-emerald-700',
		completed: 'bg-blue-50 text-blue-700',
		archived: 'bg-slate-100 text-slate-500'
	};
</script>

<svelte:head>
	<title>Projects — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Projects</h1>
			<p class="mt-1 text-sm text-slate-500">Group tasks and team members under a project.</p>
		</div>
		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
		>
			New project
		</button>
	</div>

	{#if form?.error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.projectList as project (project.id)}
			<a
				href="/projects/{project.id}"
				class="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
			>
				<div class="flex items-start justify-between gap-2">
					<h2 class="font-semibold text-slate-900">{project.name}</h2>
					<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {STATUS_STYLES[project.status]}">
						{project.status}
					</span>
				</div>
				{#if project.description}
					<p class="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
				{/if}
				<div class="mt-4 flex items-center gap-4 text-xs text-slate-400">
					<span>{project.memberCount} member{project.memberCount === 1 ? '' : 's'}</span>
					<span>{project.taskCount} task{project.taskCount === 1 ? '' : 's'}</span>
				</div>
				<p class="mt-3 text-xs text-slate-400">Owned by {project.ownerName}</p>
			</a>
		{:else}
			<p class="col-span-full py-12 text-center text-sm text-slate-400">
				No projects yet — create the first one.
			</p>
		{/each}
	</div>
</div>

{#if showCreateModal}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-900">New project</h2>
				<button
					type="button"
					onclick={() => (showCreateModal = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/createProject"
				class="space-y-4"
				use:enhance={() => {
					creating = true;
					return async ({ update }) => {
						await update();
						creating = false;
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
					<label for="description" class="mb-1 block text-sm font-medium text-slate-700">Description</label>
					<textarea
						id="description"
						name="description"
						rows="3"
						placeholder="Optional"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					></textarea>
				</div>
				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={creating}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						{creating ? 'Creating…' : 'Create project'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
