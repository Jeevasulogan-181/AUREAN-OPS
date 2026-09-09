<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	type EventRow = PageData['events'][number];

	let {
		event,
		currentUserId,
		canDelete,
		onclose
	}: {
		event: EventRow;
		currentUserId: number;
		canDelete: boolean;
		onclose: () => void;
	} = $props();

	let busy = $state(false);

	function fmt(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}

	const VISIBILITY_LABELS: Record<string, string> = {
		private: 'Private',
		team: 'Team',
		company: 'Company'
	};
	const STATUS_STYLES: Record<string, string> = {
		invited: 'bg-amber-50 text-amber-700',
		accepted: 'bg-emerald-50 text-emerald-700',
		declined: 'bg-red-50 text-red-700'
	};
</script>

<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
	<div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
		<div class="mb-1 flex items-start justify-between gap-2">
			<h2 class="text-lg font-semibold text-slate-900">{event.title}</h2>
			<button type="button" onclick={onclose} class="text-slate-400 hover:text-slate-600" aria-label="Close">
				✕
			</button>
		</div>
		<p class="text-sm text-slate-500">{fmt(event.startTime)} – {fmt(event.endTime)}</p>
		<p class="mt-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
			{VISIBILITY_LABELS[event.visibility]} · by {event.creatorName ?? 'Unknown'}
		</p>

		{#if event.description}
			<p class="mt-3 text-sm text-slate-600">{event.description}</p>
		{/if}

		{#if event.attendees.length > 0}
			<div class="mt-4">
				<p class="mb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">Attendees</p>
				<div class="space-y-1">
					{#each event.attendees as attendee (attendee.userId)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-slate-700">{attendee.fullName}</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {STATUS_STYLES[attendee.status]}">
								{attendee.status}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if event.myStatus === 'invited' || event.myStatus === 'declined' || event.myStatus === 'accepted'}
			<div class="mt-4 flex gap-2">
				<form
					method="POST"
					action="?/respondAttendance"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							await update();
							busy = false;
						};
					}}
				>
					<input type="hidden" name="eventId" value={event.id} />
					<input type="hidden" name="status" value="accepted" />
					<button
						type="submit"
						disabled={busy || event.myStatus === 'accepted'}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
					>
						Accept
					</button>
				</form>
				<form
					method="POST"
					action="?/respondAttendance"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							await update();
							busy = false;
						};
					}}
				>
					<input type="hidden" name="eventId" value={event.id} />
					<input type="hidden" name="status" value="declined" />
					<button
						type="submit"
						disabled={busy || event.myStatus === 'declined'}
						class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
					>
						Decline
					</button>
				</form>
			</div>
		{/if}

		{#if canDelete}
			<div class="mt-6 border-t border-slate-100 pt-4">
				<form
					method="POST"
					action="?/deleteEvent"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							await update();
							busy = false;
							onclose();
						};
					}}
				>
					<input type="hidden" name="eventId" value={event.id} />
					<button type="submit" disabled={busy} class="text-sm font-medium text-red-600 hover:text-red-700">
						Delete event
					</button>
				</form>
			</div>
		{/if}
	</div>
</div>
