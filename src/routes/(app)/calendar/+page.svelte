<script lang="ts">
	import type { PageData } from './$types';
	import EventModal from './EventModal.svelte';
	import EventDetailModal from './EventDetailModal.svelte';

	let { data }: { data: PageData } = $props();

	type EventRow = PageData['events'][number];

	let showCreate = $state(false);
	let createDefaultDate = $state('');
	let activeEvent = $state<EventRow | null>(null);

	// Calendar cells and event bucketing are keyed by UTC calendar date
	// (same simplification as the server-side month query) so a single-office
	// team sees consistent day boundaries regardless of browser timezone.
	function dateStr(d: Date | string): string {
		const date = d instanceof Date ? d : new Date(d);
		return date.toISOString().slice(0, 10);
	}

	function buildMonthGrid(year: number, month: number): Date[] {
		const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
		const startWeekday = firstOfMonth.getUTCDay();
		const gridStart = new Date(Date.UTC(year, month - 1, 1 - startWeekday));
		return Array.from(
			{ length: 42 },
			(_, i) => new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + i))
		);
	}

	function shiftMonthParam(delta: number): string {
		let y = data.month.year;
		let m = data.month.month + delta;
		if (m < 1) {
			m = 12;
			y -= 1;
		} else if (m > 12) {
			m = 1;
			y += 1;
		}
		return `${y}-${String(m).padStart(2, '0')}`;
	}

	const cells = $derived(buildMonthGrid(data.month.year, data.month.month));
	const todayKey = dateStr(new Date());

	const eventsByDate = $derived.by(() => {
		const map = new Map<string, EventRow[]>();
		for (const e of data.events) {
			const key = dateStr(e.startTime);
			const list = map.get(key) ?? [];
			list.push(e);
			map.set(key, list);
		}
		return map;
	});

	const VISIBILITY_DOT: Record<string, string> = {
		private: 'bg-slate-400',
		team: 'bg-blue-500',
		company: 'bg-emerald-500'
	};

	function canDelete(event: EventRow): boolean {
		const role = data.user.role;
		return role === 'admin' || role === 'superadmin' || event.createdBy === data.user.id;
	}

	function openCreate(day: Date) {
		createDefaultDate = dateStr(day);
		showCreate = true;
	}
</script>

<svelte:head>
	<title>Calendar — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Calendar</h1>
			<p class="mt-1 text-sm text-slate-500">Company, team, and private events.</p>
		</div>
		<button
			type="button"
			onclick={() => openCreate(new Date())}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
		>
			New event
		</button>
	</div>

	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<a
				href="/calendar?month={shiftMonthParam(-1)}"
				class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
				aria-label="Previous month"
			>
				‹
			</a>
			<a
				href="/calendar?month={shiftMonthParam(1)}"
				class="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
				aria-label="Next month"
			>
				›
			</a>
			<h2 class="ml-2 text-lg font-semibold text-slate-900">{data.month.label}</h2>
		</div>
		<div class="flex items-center gap-3 text-xs text-slate-500">
			<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-400"></span>Private</span>
			<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-blue-500"></span>Team</span>
			<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Company</span>
		</div>
	</div>

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
		<div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 uppercase">
			{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day (day)}
				<div class="px-2 py-2 text-center">{day}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each cells as day (day.getTime())}
				{@const key = dateStr(day)}
				{@const inMonth = day.getUTCMonth() === data.month.month - 1}
				{@const dayEvents = eventsByDate.get(key) ?? []}
				<div
					role="button"
					tabindex="0"
					onclick={() => openCreate(day)}
					onkeydown={(e) => {
						if (e.key === 'Enter') openCreate(day);
					}}
					class="min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top transition hover:bg-slate-50 {inMonth
						? 'bg-white'
						: 'bg-slate-50/50'}"
				>
					<span
						class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs {key === todayKey
							? 'bg-slate-900 font-semibold text-white'
							: inMonth
								? 'text-slate-700'
								: 'text-slate-300'}"
					>
						{day.getUTCDate()}
					</span>
					<div class="mt-1 space-y-0.5">
						{#each dayEvents.slice(0, 3) as event (event.id)}
							<div
								role="button"
								tabindex="0"
								onclick={(e) => {
									e.stopPropagation();
									activeEvent = event;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.stopPropagation();
										activeEvent = event;
									}
								}}
								class="flex items-center gap-1 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200"
							>
								<span class="h-1.5 w-1.5 shrink-0 rounded-full {VISIBILITY_DOT[event.visibility]}"></span>
								<span class="truncate">{event.title}</span>
							</div>
						{/each}
						{#if dayEvents.length > 3}
							<p class="px-1.5 text-[11px] text-slate-400">+{dayEvents.length - 3} more</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

{#if showCreate}
	<EventModal defaultDate={createDefaultDate} staffList={data.staffList} onclose={() => (showCreate = false)} />
{/if}

{#if activeEvent}
	<EventDetailModal
		event={activeEvent}
		currentUserId={data.user.id}
		canDelete={canDelete(activeEvent)}
		onclose={() => (activeEvent = null)}
	/>
{/if}
