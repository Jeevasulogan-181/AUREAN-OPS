<script lang="ts">
	import { enhance } from '$app/forms';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import Bell from '@lucide/svelte/icons/bell';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let clockBusy = $state(false);

	function fmtTime(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	function fmtDuration(clockIn: Date | string, clockOut: Date | string): string {
		const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
		const end = clockOut instanceof Date ? clockOut : new Date(clockOut);
		const ms = end.getTime() - start.getTime();
		return `${Math.floor(ms / 3_600_000)}h ${Math.round((ms % 3_600_000) / 60_000)}m`;
	}
	function fmtEventDate(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
			' · ' +
			d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	const clockStatus = $derived(
		!data.todayClockEntry ? 'not-clocked-in' : data.todayClockEntry.clockOut ? 'done' : 'clocked-in'
	);
</script>

<svelte:head>
	<title>Dashboard — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<h1 class="text-2xl font-semibold text-slate-900">Welcome back, {data.user.fullName.split(' ')[0]}</h1>
	<p class="mt-1 text-sm text-slate-500">
		Signed in as <span class="font-medium text-slate-700">{data.user.username}</span>
		<span class="capitalize">({data.user.role})</span>
	</p>

	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Clock -->
		<div class="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
			<div class="mb-3 flex items-center gap-2 text-slate-400">
				<ClockIcon size={18} />
				<span class="text-xs font-semibold tracking-wide uppercase">Today</span>
			</div>

			{#if clockStatus === 'not-clocked-in'}
				<p class="mb-3 text-sm font-medium text-slate-900">Not clocked in yet</p>
				<form
					method="POST"
					action="/clock?/clockIn"
					class="mt-auto"
					use:enhance={() => {
						clockBusy = true;
						return async ({ update }) => {
							await update();
							clockBusy = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={clockBusy}
						class="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
					>
						{clockBusy ? 'Clocking in…' : 'Clock in'}
					</button>
				</form>
			{:else if clockStatus === 'clocked-in'}
				<p class="mb-3 text-sm font-medium text-emerald-700">
					Clocked in at {fmtTime(data.todayClockEntry!.clockIn)}
				</p>
				<form
					method="POST"
					action="/clock?/clockOut"
					class="mt-auto"
					use:enhance={() => {
						clockBusy = true;
						return async ({ update }) => {
							await update();
							clockBusy = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={clockBusy}
						class="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
					>
						{clockBusy ? 'Clocking out…' : 'Clock out'}
					</button>
				</form>
			{:else}
				<p class="text-sm font-medium text-slate-900">Done for today</p>
				<p class="mt-1 text-xs text-slate-500">
					{fmtDuration(data.todayClockEntry!.clockIn, data.todayClockEntry!.clockOut!)} worked
				</p>
			{/if}

			<a href="/clock" class="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
				View history <ArrowRight size={12} />
			</a>
		</div>

		<!-- Tasks -->
		<a
			href="/tasks"
			class="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-sm"
		>
			<div class="mb-3 flex items-center gap-2 text-slate-400">
				<ListChecks size={18} />
				<span class="text-xs font-semibold tracking-wide uppercase">Tasks</span>
			</div>
			<p class="text-3xl font-semibold text-slate-900">{data.openTaskCount}</p>
			<p class="mt-1 text-sm text-slate-500">Open task{data.openTaskCount === 1 ? '' : 's'} assigned to you</p>
			<span class="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-indigo-600">
				View tasks <ArrowRight size={12} />
			</span>
		</a>

		<!-- Calendar -->
		<a
			href="/calendar"
			class="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-sm"
		>
			<div class="mb-3 flex items-center gap-2 text-slate-400">
				<CalendarIcon size={18} />
				<span class="text-xs font-semibold tracking-wide uppercase">This week</span>
			</div>
			<p class="text-3xl font-semibold text-slate-900">{data.upcomingEventCount}</p>
			<p class="mt-1 text-sm text-slate-500">Upcoming event{data.upcomingEventCount === 1 ? '' : 's'}</p>
			{#if data.upcomingEvents.length > 0}
				<ul class="mt-3 space-y-1 border-t border-slate-100 pt-3">
					{#each data.upcomingEvents as event (event.id)}
						<li class="truncate text-xs text-slate-500">
							<span class="font-medium text-slate-700">{event.title}</span> — {fmtEventDate(event.startTime)}
						</li>
					{/each}
				</ul>
			{/if}
			<span class="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-indigo-600">
				View calendar <ArrowRight size={12} />
			</span>
		</a>

		<!-- Reminders -->
		<a
			href="/reminders"
			class="flex flex-col rounded-xl border p-5 transition hover:shadow-sm {data.dueReminderCount > 0
				? 'border-red-200 bg-red-50/40 hover:border-red-300'
				: 'border-slate-200 bg-white hover:border-indigo-200'}"
		>
			<div class="mb-3 flex items-center gap-2 {data.dueReminderCount > 0 ? 'text-red-400' : 'text-slate-400'}">
				<Bell size={18} />
				<span class="text-xs font-semibold tracking-wide uppercase">Reminders</span>
			</div>
			<p class="text-3xl font-semibold {data.dueReminderCount > 0 ? 'text-red-700' : 'text-slate-900'}">
				{data.dueReminderCount}
			</p>
			<p class="mt-1 text-sm text-slate-500">Due today or overdue</p>
			<span class="mt-auto flex items-center gap-1 pt-3 text-xs font-medium text-indigo-600">
				View reminders <ArrowRight size={12} />
			</span>
		</a>
	</div>
</div>
