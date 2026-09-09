<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const user = $derived(data.user);

	// All nine modules are built now.
	const nav = [
		{ label: 'Dashboard', href: '/', built: true },
		{ label: 'Clock In/Out', href: '/clock', built: true },
		{ label: 'Tasks', href: '/tasks', built: true },
		{ label: 'Projects', href: '/projects', built: true },
		{ label: 'Calendar', href: '/calendar', built: true },
		{ label: 'Reminders', href: '/reminders', built: true },
		{ label: 'Drive', href: '/drive', built: true },
		{ label: 'Word → PDF', href: '/convert', built: true },
		{ label: 'Chat', href: '/chat', built: true }
	];

	const isAdmin = $derived(user?.role === 'superadmin');
</script>

<div class="flex min-h-screen bg-slate-50">
	<aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
		<div class="border-b border-slate-200 px-5 py-4">
			<span class="text-base font-semibold text-slate-900">Ops Hub</span>
		</div>

		<nav class="flex-1 space-y-0.5 px-3 py-4">
			{#each nav as item (item.href)}
				{#if item.built}
					{@const active =
						page.url.pathname === item.href ||
						(item.href !== '/' && page.url.pathname.startsWith(item.href + '/'))}
					<a
						href={item.href}
						class="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition {active
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						{item.label}
						{#if item.href === '/reminders' && data.dueReminderCount > 0}
							<span
								class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {active
									? 'bg-white/20 text-white'
									: 'bg-red-100 text-red-700'}"
							>
								{data.dueReminderCount}
							</span>
						{/if}
					</a>
				{:else}
					<span
						class="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
						title="Coming soon"
					>
						{item.label}
						<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400"
							>soon</span
						>
					</span>
				{/if}
			{/each}

			{#if isAdmin}
				<div class="mt-4 border-t border-slate-200 pt-4">
					<p class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Admin</p>
					<a
						href="/staff"
						class="block rounded-lg px-3 py-2 text-sm font-medium transition {page.url.pathname === '/staff'
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						Manage Staff
					</a>
				</div>
			{/if}
		</nav>

		<div class="border-t border-slate-200 p-3">
			<div class="mb-2 px-2">
				<p class="truncate text-sm font-medium text-slate-900">{user?.fullName}</p>
				<p class="truncate text-xs text-slate-500">{user?.role}</p>
			</div>
			<form method="POST" action="/logout">
				<button
					type="submit"
					class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100"
				>
					Log out
				</button>
			</form>
		</div>
	</aside>

	<main class="min-w-0 flex-1">
		{@render children()}
	</main>
</div>
