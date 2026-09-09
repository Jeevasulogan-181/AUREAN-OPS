<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Change password — Ops Hub</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-0px)] items-start justify-center p-8">
	<div class="w-full max-w-sm">
		<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
			<h1 class="mb-1 text-xl font-semibold text-slate-900">Set a new password</h1>
			<p class="mb-6 text-sm text-slate-500">
				{#if data.user.mustResetPassword}
					You're signing in with a temporary password. Choose a new one to continue.
				{:else}
					Update your account password.
				{/if}
			</p>

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
					<label for="currentPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>Current password</label
					>
					<input
						id="currentPassword"
						name="currentPassword"
						type="password"
						autocomplete="current-password"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="newPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>New password</label
					>
					<input
						id="newPassword"
						name="newPassword"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="confirmPassword" class="mb-1 block text-sm font-medium text-slate-700"
						>Confirm new password</label
					>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					{submitting ? 'Saving…' : 'Save password'}
				</button>
			</form>
		</div>
	</div>
</div>
