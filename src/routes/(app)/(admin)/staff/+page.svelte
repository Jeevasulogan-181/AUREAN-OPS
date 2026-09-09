<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let creating = $state(false);
	let busyUserId = $state<number | null>(null);

	// Close the "new employee" modal once creation succeeds, but keep the
	// temp-password banner (driven by `form`) visible after that.
	$effect(() => {
		if (form?.intent === 'createEmployee' && form.success) {
			showCreateModal = false;
		}
	});

	const roles = ['superadmin', 'admin', 'employee'] as const;
</script>

<svelte:head>
	<title>Manage Staff — Ops Hub</title>
</svelte:head>

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-slate-900">Manage Staff</h1>
			<p class="mt-1 text-sm text-slate-500">Create employee accounts, manage roles and access.</p>
		</div>
		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
		>
			New employee
		</button>
	</div>

	{#if form?.success && (form.intent === 'createEmployee' || form.intent === 'resetPassword') && form.tempPassword}
		<div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			<p class="font-medium">
				Temporary password for <span class="font-mono">{form.username}</span>:
				<span class="font-mono font-semibold">{form.tempPassword}</span>
			</p>
			<p class="mt-1 text-amber-700">
				Share this with them securely — it will not be shown again. They'll be required to set
				their own password on first login.
			</p>
		</div>
	{/if}

	{#if form?.error && form.intent !== 'createEmployee'}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
				<tr>
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">Username</th>
					<th class="px-4 py-3 font-medium">Email</th>
					<th class="px-4 py-3 font-medium">Department</th>
					<th class="px-4 py-3 font-medium">Role</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.staff as member (member.id)}
					{@const isSelf = member.id === data.user.id}
					<tr class="align-middle">
						<td class="px-4 py-3">
							<div class="font-medium text-slate-900">{member.fullName}</div>
							{#if member.mustResetPassword}
								<div class="text-xs text-amber-600">Pending first login</div>
							{/if}
						</td>
						<td class="px-4 py-3 font-mono text-slate-600">{member.username}</td>
						<td class="px-4 py-3 text-slate-600">{member.email}</td>
						<td class="px-4 py-3 text-slate-600">{member.department ?? '—'}</td>
						<td class="px-4 py-3">
							<form
								method="POST"
								action="?/changeRole"
								use:enhance={() => {
									busyUserId = member.id;
									return async ({ update }) => {
										await update();
										busyUserId = null;
									};
								}}
							>
								<input type="hidden" name="userId" value={member.id} />
								<select
									name="role"
									value={member.role}
									disabled={isSelf || busyUserId === member.id}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400"
								>
									{#each roles as role (role)}
										<option value={role}>{role}</option>
									{/each}
								</select>
							</form>
						</td>
						<td class="px-4 py-3">
							{#if member.isActive}
								<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
									>Active</span
								>
							{:else}
								<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
									>Inactive</span
								>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<form
									method="POST"
									action="?/resetPassword"
									use:enhance={() => {
										busyUserId = member.id;
										return async ({ update }) => {
											await update();
											busyUserId = null;
										};
									}}
								>
									<input type="hidden" name="userId" value={member.id} />
									<button
										type="submit"
										disabled={busyUserId === member.id}
										class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
									>
										Reset password
									</button>
								</form>
								<form
									method="POST"
									action="?/toggleActive"
									use:enhance={() => {
										busyUserId = member.id;
										return async ({ update }) => {
											await update();
											busyUserId = null;
										};
									}}
								>
									<input type="hidden" name="userId" value={member.id} />
									<button
										type="submit"
										disabled={isSelf || busyUserId === member.id}
										class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
									>
										{member.isActive ? 'Deactivate' : 'Reactivate'}
									</button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

{#if showCreateModal}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
		<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-900">New employee</h2>
				<button
					type="button"
					onclick={() => (showCreateModal = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>

			{#if form?.error && form.intent === 'createEmployee'}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{form.error}
				</div>
			{/if}

			<form
				method="POST"
				action="?/createEmployee"
				class="space-y-4"
				use:enhance={() => {
					creating = true;
					return async ({ update }) => {
						await update();
						creating = false;
					};
				}}
			>
				<div>
					<label for="fullName" class="mb-1 block text-sm font-medium text-slate-700">Full name</label>
					<input
						id="fullName"
						name="fullName"
						type="text"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div>
					<label for="username" class="mb-1 block text-sm font-medium text-slate-700">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						placeholder="e.g. j.smith"
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
					<p class="mt-1 text-xs text-slate-400">
						3-32 characters: lowercase letters, numbers, dots, dashes, underscores.
					</p>
				</div>
				<div>
					<label for="email" class="mb-1 block text-sm font-medium text-slate-700">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="department" class="mb-1 block text-sm font-medium text-slate-700"
							>Department</label
						>
						<input
							id="department"
							name="department"
							type="text"
							placeholder="Optional"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
						/>
					</div>
					<div>
						<label for="role" class="mb-1 block text-sm font-medium text-slate-700">Role</label>
						<select
							id="role"
							name="role"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
						>
							<option value="employee" selected>employee</option>
							<option value="admin">admin</option>
							<option value="superadmin">superadmin</option>
						</select>
					</div>
				</div>
				<p class="text-xs text-slate-500">
					A temporary password is generated automatically and shown once after creation.
				</p>
				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={creating}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						{creating ? 'Creating…' : 'Create employee'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
