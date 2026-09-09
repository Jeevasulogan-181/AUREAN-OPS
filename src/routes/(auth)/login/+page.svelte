<script lang="ts">
	import { enhance } from '$app/forms';
	import Building2 from '@lucide/svelte/icons/building-2';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Lock from '@lucide/svelte/icons/lock';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import UserX from '@lucide/svelte/icons/user-x';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);

	// Purely a presentation choice (which icon reads best) — the server
	// action's error copy and logic are unchanged; this just recognizes the
	// existing "deactivated" wording to pick a more specific icon.
	const isDeactivated = $derived(form?.error?.toLowerCase().includes('deactivated') ?? false);
</script>

<svelte:head>
	<title>Sign in — Ops Hub</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-slate-50 to-indigo-50 px-4"
>
	<div class="w-full max-w-sm">
		<div class="mb-6 flex flex-col items-center gap-3 text-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30">
				<Building2 size={24} />
			</div>
			<div>
				<p class="text-lg font-semibold text-slate-900">Ops Hub</p>
				<p class="text-sm text-slate-500">Internal staff portal</p>
			</div>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/5">
			<h1 class="mb-1 text-xl font-semibold text-slate-900">Welcome back</h1>
			<p class="mb-6 text-sm text-slate-500">Sign in with your staff account to continue.</p>

			{#if form?.error}
				<div class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
					{#if isDeactivated}
						<UserX size={16} class="mt-0.5 shrink-0" />
					{:else}
						<CircleAlert size={16} class="mt-0.5 shrink-0" />
					{/if}
					<span>{form.error}</span>
				</div>
			{/if}

			<form
				method="POST"
				class="space-y-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<div>
					<label for="username" class="mb-1 block text-sm font-medium text-slate-700">Username</label>
					<div class="relative">
						<UserRound size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
						<input
							id="username"
							name="username"
							type="text"
							autocomplete="username"
							required
							value={form?.username ?? ''}
							class="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
						/>
					</div>
				</div>
				<div>
					<label for="password" class="mb-1 block text-sm font-medium text-slate-700">Password</label>
					<div class="relative">
						<Lock size={16} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="current-password"
							required
							class="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
						/>
					</div>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
				>
					{#if submitting}
						<LoaderCircle size={16} class="animate-spin" />
					{/if}
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>

		<p class="mt-6 text-center text-xs text-slate-400">
			Internal tool — contact your administrator if you need access.
		</p>
	</div>
</div>
