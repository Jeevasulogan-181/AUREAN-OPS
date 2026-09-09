import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { chatChannelMembers, chatChannels, chatMessages, users } from '$lib/server/db/schema';

// Senders can fix a typo shortly after posting, but this isn't meant to be a
// full edit history — a short window keeps "edited" messages close to what
// people actually saw land in the channel.
const EDIT_WINDOW_MS = 15 * 60 * 1000;

async function loadChannelOr404(channelId: number) {
	const [channel] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId));
	if (!channel) {
		throw error(404, 'Channel not found');
	}
	return channel;
}

async function isMember(channelId: number, userId: number): Promise<boolean> {
	const [row] = await db
		.select({ userId: chatChannelMembers.userId })
		.from(chatChannelMembers)
		.where(and(eq(chatChannelMembers.channelId, channelId), eq(chatChannelMembers.userId, userId)));
	return !!row;
}

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	const userId = locals.user.id;

	// Polled on an interval from the client while a channel is open — see
	// +page.svelte. This is a prototype's stand-in for real-time updates;
	// swapping to WebSockets/SSE later replaces this dependency entirely.
	depends('app:chat-messages');

	// Doesn't depend on anything below — kick it off now so it overlaps with
	// the membership/channel/message lookups instead of waiting behind them.
	const staffListPromise = db
		.select({ id: users.id, fullName: users.fullName })
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.fullName);

	const memberOf = await db
		.select({ channelId: chatChannelMembers.channelId })
		.from(chatChannelMembers)
		.where(eq(chatChannelMembers.userId, userId));
	const myChannelIds = memberOf.map((r) => r.channelId);

	// Both depend only on myChannelIds, not on each other.
	const [channelRows, memberRows] = await Promise.all([
		myChannelIds.length
			? db.select().from(chatChannels).where(inArray(chatChannels.id, myChannelIds))
			: Promise.resolve([]),
		myChannelIds.length
			? db
					.select({
						channelId: chatChannelMembers.channelId,
						userId: chatChannelMembers.userId,
						fullName: users.fullName
					})
					.from(chatChannelMembers)
					.innerJoin(users, eq(chatChannelMembers.userId, users.id))
					.where(inArray(chatChannelMembers.channelId, myChannelIds))
			: Promise.resolve([])
	]);

	const membersByChannel = new Map<number, typeof memberRows>();
	for (const m of memberRows) {
		const list = membersByChannel.get(m.channelId) ?? [];
		list.push(m);
		membersByChannel.set(m.channelId, list);
	}

	const channelList = channelRows
		.map((c) => {
			const members = membersByChannel.get(c.id) ?? [];
			const displayName = c.isDirectMessage
				? (members.find((m) => m.userId !== userId)?.fullName ?? 'Direct message')
				: (c.name ?? 'Untitled channel');
			return { ...c, displayName, members };
		})
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	const groupChannels = channelList.filter((c) => !c.isDirectMessage);
	const dmChannels = channelList.filter((c) => c.isDirectMessage);

	let channelId = params.channelId ? Number(params.channelId) : null;
	if (params.channelId && !channelId) {
		throw error(404, 'Channel not found');
	}

	// Land on the first available channel rather than an empty panel, same
	// spirit as most chat apps.
	if (!channelId && channelList.length > 0) {
		throw redirect(302, `/chat/${channelList[0].id}`);
	}

	let activeChannel: (typeof channelList)[number] | null = null;
	let messages: Array<{
		id: number;
		channelId: number;
		senderId: number;
		content: string;
		createdAt: Date;
		editedAt: Date | null;
		senderName: string;
	}> = [];

	if (channelId) {
		activeChannel = channelList.find((c) => c.id === channelId) ?? null;
		if (!activeChannel) {
			// Either the channel doesn't exist or this user isn't a member —
			// same 404 either way so membership can't be probed for.
			throw error(404, 'Channel not found');
		}

		messages = await db
			.select({
				id: chatMessages.id,
				channelId: chatMessages.channelId,
				senderId: chatMessages.senderId,
				content: chatMessages.content,
				createdAt: chatMessages.createdAt,
				editedAt: chatMessages.editedAt,
				senderName: users.fullName
			})
			.from(chatMessages)
			.innerJoin(users, eq(chatMessages.senderId, users.id))
			.where(eq(chatMessages.channelId, channelId))
			.orderBy(chatMessages.createdAt);
	}

	const staffList = await staffListPromise;

	return {
		groupChannels,
		dmChannels,
		activeChannel,
		messages,
		staffList,
		editWindowMs: EDIT_WINDOW_MS
	};
};

export const actions: Actions = {
	createChannel: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createChannel' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const memberIds = formData
			.getAll('memberIds')
			.map((v) => Number(v))
			.filter((n) => Number.isInteger(n) && n !== locals.user!.id);

		if (!name) {
			return fail(400, { intent: 'createChannel' as const, error: 'Channel name is required' });
		}

		const [created] = await db
			.insert(chatChannels)
			.values({ name, isDirectMessage: false, createdBy: locals.user.id })
			.returning({ id: chatChannels.id });

		const members = [locals.user.id, ...memberIds];
		await db
			.insert(chatChannelMembers)
			.values(members.map((userId) => ({ channelId: created.id, userId })))
			.onConflictDoNothing();

		throw redirect(302, `/chat/${created.id}`);
	},

	createDm: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'createDm' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const otherUserId = Number(formData.get('otherUserId'));
		if (!otherUserId || otherUserId === locals.user.id) {
			return fail(400, { intent: 'createDm' as const, error: 'Choose someone to message' });
		}

		// Reuse an existing DM between exactly these two people, if there is one.
		const cm2 = alias(chatChannelMembers, 'cm2');
		const [existing] = await db
			.select({ channelId: chatChannelMembers.channelId })
			.from(chatChannelMembers)
			.innerJoin(cm2, eq(chatChannelMembers.channelId, cm2.channelId))
			.innerJoin(chatChannels, eq(chatChannels.id, chatChannelMembers.channelId))
			.where(
				and(
					eq(chatChannels.isDirectMessage, true),
					eq(chatChannelMembers.userId, locals.user.id),
					eq(cm2.userId, otherUserId)
				)
			);

		if (existing) {
			throw redirect(302, `/chat/${existing.channelId}`);
		}

		const [created] = await db
			.insert(chatChannels)
			.values({ name: null, isDirectMessage: true, createdBy: locals.user.id })
			.returning({ id: chatChannels.id });

		await db
			.insert(chatChannelMembers)
			.values([
				{ channelId: created.id, userId: locals.user.id },
				{ channelId: created.id, userId: otherUserId }
			])
			.onConflictDoNothing();

		throw redirect(302, `/chat/${created.id}`);
	},

	sendMessage: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'sendMessage' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const channelId = Number(formData.get('channelId'));
		const content = String(formData.get('content') ?? '').trim();

		if (!channelId) {
			return fail(400, { intent: 'sendMessage' as const, error: 'Missing channel' });
		}
		if (!content) {
			return fail(400, { intent: 'sendMessage' as const, error: 'Message cannot be empty' });
		}
		if (!(await isMember(channelId, locals.user.id))) {
			return fail(403, { intent: 'sendMessage' as const, error: 'You are not a member of this channel' });
		}

		await db.insert(chatMessages).values({ channelId, senderId: locals.user.id, content });

		return { intent: 'sendMessage' as const, success: true };
	},

	editMessage: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'editMessage' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const messageId = Number(formData.get('messageId'));
		const content = String(formData.get('content') ?? '').trim();

		if (!messageId) {
			return fail(400, { intent: 'editMessage' as const, error: 'Missing message' });
		}
		if (!content) {
			return fail(400, { intent: 'editMessage' as const, error: 'Message cannot be empty' });
		}

		const [existing] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId));
		if (!existing) {
			return fail(404, { intent: 'editMessage' as const, error: 'Message not found' });
		}
		if (existing.senderId !== locals.user.id) {
			return fail(403, { intent: 'editMessage' as const, error: 'You can only edit your own messages' });
		}
		if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
			return fail(403, { intent: 'editMessage' as const, error: 'The edit window for this message has passed' });
		}

		await db
			.update(chatMessages)
			.set({ content, editedAt: new Date() })
			.where(eq(chatMessages.id, messageId));

		return { intent: 'editMessage' as const, success: true };
	},

	addMember: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { intent: 'addMember' as const, error: 'Not signed in' });
		}

		const formData = await request.formData();
		const channelId = Number(formData.get('channelId'));
		const userId = Number(formData.get('userId'));
		if (!channelId || !userId) {
			return fail(400, { intent: 'addMember' as const, error: 'Invalid request' });
		}

		const channel = await loadChannelOr404(channelId);
		if (channel.isDirectMessage) {
			return fail(403, { intent: 'addMember' as const, error: 'You cannot add people to a direct message' });
		}
		if (!(await isMember(channelId, locals.user.id))) {
			return fail(403, { intent: 'addMember' as const, error: 'You are not a member of this channel' });
		}

		await db.insert(chatChannelMembers).values({ channelId, userId }).onConflictDoNothing();

		return { intent: 'addMember' as const, success: true };
	}
};
