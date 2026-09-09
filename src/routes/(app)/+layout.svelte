<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Clock from '@lucide/svelte/icons/clock';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import Bell from '@lucide/svelte/icons/bell';
	import NotebookPen from '@lucide/svelte/icons/notebook-pen';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Users from '@lucide/svelte/icons/users';
	import LogOut from '@lucide/svelte/icons/log-out';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const user = $derived(data.user);

	// All modules are built now — Notes added on top of the original nine.
	const nav: { label: string; href: string; icon: Component; built: boolean }[] = [
		{ label: 'Dashboard', href: '/', icon: LayoutDashboard, built: true },
		{ label: 'Clock In/Out', href: '/clock', icon: Clock, built: true },
		{ label: 'Tasks', href: '/tasks', icon: ListChecks, built: true },
		{ label: 'Projects', href: '/projects', icon: FolderKanban, built: true },
		{ label: 'Calendar', href: '/calendar', icon: CalendarIcon, built: true },
		{ label: 'Reminders', href: '/reminders', icon: Bell, built: true },
		{ label: 'Notes', href: '/notes', icon: NotebookPen, built: true },
		{ label: 'Drive', href: '/drive', icon: HardDrive, built: true },
		{ label: 'Word → PDF', href: '/convert', icon: FileText, built: true },
		{ label: 'Chat', href: '/chat', icon: MessageSquare, built: true }
	];

	const isAdmin = $derived(user?.role === 'superadmin');

	const initials = $derived(
		(user?.fullName ?? '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('') || '?'
	);

	const todayLabel = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
</script>

<div class="flex h-screen overflow-hidden bg-slate-50">
	<aside class="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
		<div class="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
				<Building2 size={16} />
			</div>
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
						class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition {active
							? 'bg-indigo-600 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						<item.icon size={17} class="shrink-0" />
						<span class="flex-1 truncate">{item.label}</span>
						{#if item.href === '/reminders' && data.dueReminderCount > 0}
							<span
								class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {active
									? 'bg-white/20 text-white'
									: 'bg-red-100 text-red-700'}"
							>
								{data.dueReminderCount}
							</span>
						{/if}
					</a>
				{:else}
					<span
						class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
						title="Coming soon"
					>
						<item.icon size={17} class="shrink-0" />
						<span class="flex-1 truncate">{item.label}</span>
						<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
							soon
						</span>
					</span>
				{/if}
			{/each}

			{#if isAdmin}
				<div class="mt-4 border-t border-slate-200 pt-4">
					<p class="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Admin</p>
					<a
						href="/staff"
						class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition {page.url
							.pathname === '/staff'
							? 'bg-indigo-600 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						<Users size={17} class="shrink-0" />
						Manage Staff
					</a>
				</div>
			{/if}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
			<p class="hidden text-sm text-slate-500 sm:block">{todayLabel}</p>

			<div class="ml-auto flex items-center gap-3">
				<div class="flex items-center gap-2.5">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
					>
						{initials}
					</div>
					<div class="hidden leading-tight sm:block">
						<p class="truncate text-sm font-medium text-slate-900">{user?.fullName}</p>
						<p class="truncate text-xs text-slate-500 capitalize">{user?.role}</p>
					</div>
				</div>
				<form method="POST" action="/logout">
					<button
						type="submit"
						aria-label="Log out"
						title="Log out"
						class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
					>
						<LogOut size={18} />
					</button>
				</form>
			</div>
		</header>

		<main class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>
