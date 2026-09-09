<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<h1 class="text-2xl font-semibold text-slate-900">Welcome, {data.user.fullName.split(' ')[0]}</h1>
	<p class="mt-1 text-sm text-slate-500">
		Signed in as <span class="font-medium text-slate-700">{data.user.username}</span> ({data.user.role})
	</p>

	<div class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
		Auth and staff management are live. The rest of the modules (clock in/out, tasks, projects,
		calendar, reminders, drive, doc converter, chat) are on the sidebar as placeholders, built
		next in priority order.
	</div>
</div>
