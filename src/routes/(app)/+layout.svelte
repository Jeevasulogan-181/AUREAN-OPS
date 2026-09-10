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

	function isActive(href: string): boolean {
		return page.url.pathname === href || (href !== '/' && page.url.pathname.startsWith(href + '/'));
	}

	const isAdmin = $derived(user?.role === 'superadmin');

	// The rail is icon-only, so the top bar carries the current section's
	// name instead — the one piece of the old text sidebar this layout would
	// otherwise lose entirely.
	const pageTitle = $derived(
		nav.find((item) => isActive(item.href))?.label ?? (isActive('/staff') ? 'Manage Staff' : 'Ops Hub')
	);

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

{#snippet railIcon(item: { label: string; href: string; icon: Component }, badge?: number)}
	{@const active = isActive(item.href)}
	<a
		href={item.href}
		aria-label={item.label}
		class="group relative flex h-11 w-11 items-center justify-center rounded-xl transition {active
			? 'bg-white text-indigo-700'
			: 'text-indigo-200 hover:bg-white/10 hover:text-white'}"
	>
		<item.icon size={20} />
		{#if badge && badge > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
			>
				{badge}
			</span>
		{/if}
		<span
			class="pointer-events-none absolute left-full z-20 ml-3 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition group-hover:opacity-100"
		>
			{item.label}
		</span>
	</a>
{/snippet}

<div class="flex h-screen overflow-hidden bg-slate-50">
	<!-- Icon-only rail: primary navigation, always visible. No overflow-y
	     here — with ~11 icons at 48px each this never needs to scroll, and
	     `overflow` on this element would clip the hover tooltips, which
	     pop out past the rail's own right edge. -->
	<aside class="flex w-16 shrink-0 flex-col items-center gap-1 bg-indigo-950 py-3">
		<div class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white">
			<Building2 size={20} />
		</div>

		<nav class="flex flex-1 flex-col items-center gap-1">
			{#each nav as item (item.href)}
				{#if item.built}
					{@render railIcon(item, item.href === '/reminders' ? data.dueReminderCount : undefined)}
				{:else}
					<span
						class="relative flex h-11 w-11 items-center justify-center rounded-xl text-indigo-400/50"
						title="{item.label} — coming soon"
					>
						<item.icon size={20} />
					</span>
				{/if}
			{/each}
		</nav>

		{#if isAdmin}
			<div class="mt-1 flex flex-col items-center gap-1 border-t border-white/10 pt-2">
				{@render railIcon({ label: 'Manage Staff', href: '/staff', icon: Users })}
			</div>
		{/if}
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
			<h1 class="text-sm font-semibold text-slate-900">{pageTitle}</h1>

			<div class="flex items-center gap-3">
				<p class="hidden text-sm text-slate-500 sm:block">{todayLabel}</p>
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
