<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in — Ops Hub</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
	<div class="w-full max-w-sm">
		<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
			<h1 class="mb-1 text-xl font-semibold text-slate-900">Sign in</h1>
			<p class="mb-6 text-sm text-slate-500">Ops Hub — staff login</p>

			{#if form?.error}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{form.error}
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
					<input
						id="username"
						name="username"
						type="text"
						autocomplete="username"
						required
						value={form?.username ?? ''}
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="password" class="mb-1 block text-sm font-medium text-slate-700">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	</div>
</div>
