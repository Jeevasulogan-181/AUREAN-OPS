<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let busy = $state(false);

	function fmtTime(value: Date | string | null): string {
		if (!value) return '—';
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function fmtDuration(clockIn: Date | string, clockOut: Date | string | null): string {
		if (!clockOut) return '—';
		const start = clockIn instanceof Date ? clockIn : new Date(clockIn);
		const end = clockOut instanceof Date ? clockOut : new Date(clockOut);
		const ms = end.getTime() - start.getTime();
		const hours = Math.floor(ms / 3_600_000);
		const minutes = Math.round((ms % 3_600_000) / 60_000);
		return `${hours}h ${minutes}m`;
	}

	const status = $derived(
		!data.todayEntry ? 'not-clocked-in' : data.todayEntry.clockOut ? 'done' : 'clocked-in'
	);
</script>

<svelte:head>
	<title>Clock In/Out — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<h1 class="text-2xl font-semibold text-slate-900">Clock In / Out</h1>
	<p class="mt-1 text-sm text-slate-500">Track your working hours for today.</p>

	{#if form?.error}
		<div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="mt-6 max-w-md rounded-xl border border-slate-200 bg-white p-6">
		<p class="text-xs font-medium tracking-wide text-slate-400 uppercase">Today</p>

		{#if status === 'not-clocked-in'}
			<p class="mt-1 text-lg font-semibold text-slate-900">Not clocked in yet</p>
			<form
				method="POST"
				action="?/clockIn"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={busy}
					class="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{busy ? 'Clocking in…' : 'Clock in'}
				</button>
			</form>
		{:else if status === 'clocked-in'}
			<p class="mt-1 text-lg font-semibold text-emerald-700">
				Clocked in at {fmtTime(data.todayEntry?.clockIn ?? null)}
			</p>
			<form
				method="POST"
				action="?/clockOut"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={busy}
					class="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{busy ? 'Clocking out…' : 'Clock out'}
				</button>
			</form>
		{:else}
			<p class="mt-1 text-lg font-semibold text-slate-900">Done for today</p>
			<p class="mt-1 text-sm text-slate-500">
				{fmtTime(data.todayEntry?.clockIn ?? null)} – {fmtTime(data.todayEntry?.clockOut ?? null)}
				· {fmtDuration(data.todayEntry!.clockIn, data.todayEntry!.clockOut)}
			</p>
		{/if}
	</div>

	<div class="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
		<div class="border-b border-slate-200 px-4 py-3">
			<h2 class="text-sm font-semibold text-slate-900">My recent history</h2>
		</div>
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
				<tr>
					<th class="px-4 py-2 font-medium">Date</th>
					<th class="px-4 py-2 font-medium">Clock in</th>
					<th class="px-4 py-2 font-medium">Clock out</th>
					<th class="px-4 py-2 font-medium">Duration</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.myHistory as entry (entry.id)}
					<tr>
						<td class="px-4 py-2 text-slate-600">{entry.date}</td>
						<td class="px-4 py-2 text-slate-600">{fmtTime(entry.clockIn)}</td>
						<td class="px-4 py-2 text-slate-600">{fmtTime(entry.clockOut)}</td>
						<td class="px-4 py-2 text-slate-600">{fmtDuration(entry.clockIn, entry.clockOut)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="px-4 py-6 text-center text-slate-400">No entries yet</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.manager}
		<div class="mt-10">
			<h2 class="text-lg font-semibold text-slate-900">Team history</h2>
			<p class="mt-1 text-sm text-slate-500">All staff clock entries, filterable by date range and employee.</p>

			<form method="GET" class="mt-4 flex flex-wrap items-end gap-3">
				<div>
					<label for="from" class="mb-1 block text-xs font-medium text-slate-700">From</label>
					<input
						id="from"
						name="from"
						type="date"
						value={data.filters?.from}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="to" class="mb-1 block text-xs font-medium text-slate-700">To</label>
					<input
						id="to"
						name="to"
						type="date"
						value={data.filters?.to}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="employeeId" class="mb-1 block text-xs font-medium text-slate-700">Employee</label>
					<select
						id="employeeId"
						name="employeeId"
						value={data.filters?.employeeId ?? ''}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						<option value="">All staff</option>
						{#each data.staffList ?? [] as staffMember (staffMember.id)}
							<option value={staffMember.id}>{staffMember.fullName}</option>
						{/each}
					</select>
				</div>
				<button
					type="submit"
					class="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
				>
					Apply
				</button>
			</form>

			<div class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
						<tr>
							<th class="px-4 py-2 font-medium">Employee</th>
							<th class="px-4 py-2 font-medium">Date</th>
							<th class="px-4 py-2 font-medium">Clock in</th>
							<th class="px-4 py-2 font-medium">Clock out</th>
							<th class="px-4 py-2 font-medium">Duration</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each data.teamHistory ?? [] as entry (entry.id)}
							<tr>
								<td class="px-4 py-2 font-medium text-slate-900">{entry.fullName}</td>
								<td class="px-4 py-2 text-slate-600">{entry.date}</td>
								<td class="px-4 py-2 text-slate-600">{fmtTime(entry.clockIn)}</td>
								<td class="px-4 py-2 text-slate-600">{fmtTime(entry.clockOut)}</td>
								<td class="px-4 py-2 text-slate-600">{fmtDuration(entry.clockIn, entry.clockOut)}</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-4 py-6 text-center text-slate-400"
									>No entries in this range</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
