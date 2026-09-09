<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import type { ActionData, PageData } from './$types';
	import NewChannelModal from '../NewChannelModal.svelte';
	import NewDmModal from '../NewDmModal.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showNewChannel = $state(false);
	let showNewDm = $state(false);
	let showAddMember = $state(false);
	let editingMessageId = $state<number | null>(null);
	let sending = $state(false);
	let messageInput: HTMLInputElement | undefined = $state();
	let scrollEl: HTMLDivElement | undefined = $state();

	const invitableStaff = $derived(data.staffList.filter((s) => s.id !== data.user.id));
	const nonMembers = $derived(
		data.activeChannel
			? data.staffList.filter((s) => !data.activeChannel!.members.some((m) => m.userId === s.id))
			: []
	);

	function fmt(value: Date | string): string {
		const d = value instanceof Date ? value : new Date(value);
		return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
	}

	function canEdit(message: PageData['messages'][number]): boolean {
		if (message.senderId !== data.user.id) return false;
		const createdAt = message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt);
		return Date.now() - createdAt.getTime() <= data.editWindowMs;
	}

	// Poll for new messages while a channel is open. Keyed on the channel id
	// (a stable primitive) rather than the whole `data` object, so this
	// doesn't reset its own timer on every poll tick.
	$effect(() => {
		const channelId = data.activeChannel?.id;
		if (!channelId) return;
		const interval = setInterval(() => invalidate('app:chat-messages'), 4000);
		return () => clearInterval(interval);
	});

	// Keep the message list scrolled to the newest message.
	$effect(() => {
		data.messages.length;
		scrollEl?.scrollTo({ top: scrollEl.scrollHeight });
	});
</script>

<svelte:head>
	<title>Chat — Ops Hub</title>
</svelte:head>

<div class="flex h-screen">
	<div class="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
		<div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
			<h1 class="text-lg font-semibold text-slate-900">Chat</h1>
		</div>

		<div class="flex-1 overflow-y-auto px-3 py-3">
			<div class="mb-4">
				<div class="mb-1 flex items-center justify-between px-1">
					<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Channels</p>
					<button type="button" onclick={() => (showNewChannel = true)} class="text-xs font-medium text-slate-500 hover:text-slate-900">
						+ New
					</button>
				</div>
				{#each data.groupChannels as channel (channel.id)}
					<a
						href="/chat/{channel.id}"
						class="block truncate rounded-lg px-3 py-2 text-sm font-medium transition {page.params.channelId ===
						String(channel.id)
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						# {channel.displayName}
					</a>
				{:else}
					<p class="px-3 py-2 text-xs text-slate-400">No channels yet</p>
				{/each}
			</div>

			<div>
				<div class="mb-1 flex items-center justify-between px-1">
					<p class="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Direct messages</p>
					<button type="button" onclick={() => (showNewDm = true)} class="text-xs font-medium text-slate-500 hover:text-slate-900">
						+ New
					</button>
				</div>
				{#each data.dmChannels as channel (channel.id)}
					<a
						href="/chat/{channel.id}"
						class="block truncate rounded-lg px-3 py-2 text-sm font-medium transition {page.params.channelId ===
						String(channel.id)
							? 'bg-slate-900 text-white'
							: 'text-slate-600 hover:bg-slate-100'}"
					>
						{channel.displayName}
					</a>
				{:else}
					<p class="px-3 py-2 text-xs text-slate-400">No conversations yet</p>
				{/each}
			</div>
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col bg-slate-50">
		{#if data.activeChannel}
			<div class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
				<div>
					<h2 class="font-semibold text-slate-900">
						{data.activeChannel.isDirectMessage ? data.activeChannel.displayName : `# ${data.activeChannel.displayName}`}
					</h2>
					{#if !data.activeChannel.isDirectMessage}
						<p class="text-xs text-slate-400">
							{data.activeChannel.members.map((m) => m.fullName).join(', ')}
						</p>
					{/if}
				</div>
				{#if !data.activeChannel.isDirectMessage}
					<button
						type="button"
						onclick={() => (showAddMember = true)}
						class="text-sm font-medium text-slate-500 hover:text-slate-900"
					>
						+ Add people
					</button>
				{/if}
			</div>

			{#if form?.error}
				<div class="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
					{form.error}
				</div>
			{/if}

			<div bind:this={scrollEl} class="flex-1 space-y-4 overflow-y-auto px-6 py-4">
				{#each data.messages as message (message.id)}
					<div>
						<div class="flex items-baseline gap-2">
							<span class="text-sm font-semibold text-slate-900">{message.senderName}</span>
							<span class="text-xs text-slate-400">{fmt(message.createdAt)}</span>
							{#if message.editedAt}
								<span class="text-xs text-slate-400">(edited)</span>
							{/if}
						</div>

						{#if editingMessageId === message.id}
							<form
								method="POST"
								action="?/editMessage"
								class="mt-1 flex gap-2"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type !== 'failure') editingMessageId = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="messageId" value={message.id} />
								<input
									name="content"
									type="text"
									value={message.content}
									required
									class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
								/>
								<button
									type="submit"
									class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
								>
									Save
								</button>
								<button
									type="button"
									onclick={() => (editingMessageId = null)}
									class="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
								>
									Cancel
								</button>
							</form>
						{:else}
							<div class="group flex items-start gap-2">
								<p class="text-sm text-slate-700">{message.content}</p>
								{#if canEdit(message)}
									<button
										type="button"
										onclick={() => (editingMessageId = message.id)}
										class="text-xs font-medium text-slate-400 opacity-0 hover:text-slate-700 group-hover:opacity-100"
									>
										Edit
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<p class="py-12 text-center text-sm text-slate-400">No messages yet — say hello.</p>
				{/each}
			</div>

			<form
				method="POST"
				action="?/sendMessage"
				class="flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-4"
				use:enhance={() => {
					sending = true;
					return async ({ result, update }) => {
						sending = false;
						if (result.type !== 'failure' && messageInput) messageInput.value = '';
						await update({ invalidateAll: true });
					};
				}}
			>
				<input type="hidden" name="channelId" value={data.activeChannel.id} />
				<input
					bind:this={messageInput}
					name="content"
					type="text"
					required
					autocomplete="off"
					placeholder="Message {data.activeChannel.isDirectMessage ? data.activeChannel.displayName : '#' + data.activeChannel.displayName}"
					class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
				/>
				<button
					type="submit"
					disabled={sending}
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
				>
					Send
				</button>
			</form>
		{:else}
			<div class="flex flex-1 items-center justify-center">
				<p class="text-sm text-slate-400">Select a channel, or start a new one.</p>
			</div>
		{/if}
	</div>
</div>

{#if showNewChannel}
	<NewChannelModal staffList={invitableStaff} onclose={() => (showNewChannel = false)} />
{/if}

{#if showNewDm}
	<NewDmModal staffList={invitableStaff} onclose={() => (showNewDm = false)} />
{/if}

{#if showAddMember && data.activeChannel}
	<div class="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 px-4">
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-900">Add people to #{data.activeChannel.displayName}</h2>
				<button
					type="button"
					onclick={() => (showAddMember = false)}
					class="text-slate-400 hover:text-slate-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>
			<form
				method="POST"
				action="?/addMember"
				class="space-y-4"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showAddMember = false;
					};
				}}
			>
				<input type="hidden" name="channelId" value={data.activeChannel.id} />
				<div>
					<label for="userId" class="mb-1 block text-sm font-medium text-slate-700">Employee</label>
					<select
						id="userId"
						name="userId"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
					>
						{#each nonMembers as staffMember (staffMember.id)}
							<option value={staffMember.id}>{staffMember.fullName}</option>
						{:else}
							<option disabled>Everyone is already in this channel</option>
						{/each}
					</select>
				</div>
				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (showAddMember = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={nonMembers.length === 0}
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						Add
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
