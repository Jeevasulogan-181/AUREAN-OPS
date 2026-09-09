import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
	boolean,
	customType,
	date,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

// Raw file bytes, stored directly in Postgres for this prototype. Values come
// back from different drivers in different shapes (a Buffer already, a
// Postgres hex-format "\x..." string, or base64) so fromDriver normalizes all
// of them to a Buffer; toDriver writes the standard Postgres hex format that
// bytea_in accepts. Swapping to Vercel Blob/R2/S3 later touches only
// `lib/server/fileStorage.ts` — this column stops being read directly.
const bytea = customType<{ data: Buffer }>({
	dataType() {
		return 'bytea';
	},
	toDriver(value: Buffer): string {
		return '\\x' + value.toString('hex');
	},
	fromDriver(value: unknown): Buffer {
		if (Buffer.isBuffer(value)) return value;
		if (typeof value === 'string') {
			if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
			return Buffer.from(value, 'base64');
		}
		return Buffer.alloc(0);
	}
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum('role', ['superadmin', 'admin', 'employee']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'in_progress', 'done']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const projectStatusEnum = pgEnum('project_status', ['active', 'completed', 'archived']);
export const eventVisibilityEnum = pgEnum('event_visibility', ['private', 'team', 'company']);
export const attendeeStatusEnum = pgEnum('attendee_status', ['invited', 'accepted', 'declined']);
export const docConversionStatusEnum = pgEnum('doc_conversion_status', [
	'pending',
	'processing',
	'completed',
	'failed'
]);

// ---------------------------------------------------------------------------
// Auth: users + sessions
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	fullName: text('full_name').notNull(),
	email: text('email').notNull().unique(),
	role: roleEnum('role').notNull().default('employee'),
	department: text('department'),
	isActive: boolean('is_active').notNull().default(true),
	mustResetPassword: boolean('must_reset_password').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Session id is the SHA-256 hash (hex) of the token stored in the client's
// cookie — the raw token never touches the database. See lib/server/auth/session.ts.
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

// ---------------------------------------------------------------------------
// Projects + tasks
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	ownerId: integer('owner_id')
		.notNull()
		.references(() => users.id),
	status: projectStatusEnum('status').notNull().default('active'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const projectMembers = pgTable(
	'project_members',
	{
		projectId: integer('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		roleInProject: text('role_in_project').notNull().default('member')
	},
	(table) => [primaryKey({ columns: [table.projectId, table.userId] })]
);

export const tasks = pgTable('tasks', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description'),
	assignedTo: integer('assigned_to').references(() => users.id),
	createdBy: integer('created_by')
		.notNull()
		.references(() => users.id),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
	status: taskStatusEnum('status').notNull().default('todo'),
	priority: taskPriorityEnum('priority').notNull().default('medium'),
	dueDate: timestamp('due_date', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export const calendarEvents = pgTable('calendar_events', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description'),
	startTime: timestamp('start_time', { withTimezone: true }).notNull(),
	endTime: timestamp('end_time', { withTimezone: true }).notNull(),
	createdBy: integer('created_by')
		.notNull()
		.references(() => users.id),
	visibility: eventVisibilityEnum('visibility').notNull().default('team')
});

export const eventAttendees = pgTable(
	'event_attendees',
	{
		eventId: integer('event_id')
			.notNull()
			.references(() => calendarEvents.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		status: attendeeStatusEnum('status').notNull().default('invited')
	},
	(table) => [primaryKey({ columns: [table.eventId, table.userId] })]
);

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const reminders = pgTable('reminders', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
	isDone: boolean('is_done').notNull().default(false),
	relatedTaskId: integer('related_task_id').references(() => tasks.id, { onDelete: 'set null' })
});

// ---------------------------------------------------------------------------
// Drive: folders + files
// ---------------------------------------------------------------------------

export const folders = pgTable('folders', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	parentFolderId: integer('parent_folder_id').references((): AnyPgColumn => folders.id, {
		onDelete: 'cascade'
	}),
	ownerId: integer('owner_id')
		.notNull()
		.references(() => users.id),
	// Array of user ids (numbers) that this folder is shared with, or the
	// literal string "company" to mean "shared with everyone".
	sharedWith: jsonb('shared_with').notNull().default([]).$type<(number | 'company')[]>()
});

export const files = pgTable('files', {
	id: serial('id').primaryKey(),
	ownerId: integer('owner_id')
		.notNull()
		.references(() => users.id),
	filename: text('filename').notNull(),
	// Opaque key into whatever the storage backend is — see
	// lib/server/fileStorage.ts. For the current Postgres-bytea backend this
	// is a "pg:<uuid>" string used to look up the row by `content` below.
	storagePath: text('storage_path').notNull(),
	size: integer('size').notNull(),
	mimeType: text('mime_type').notNull(),
	folderId: integer('folder_id').references(() => folders.id, { onDelete: 'set null' }),
	content: bytea('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export const chatChannels = pgTable('chat_channels', {
	id: serial('id').primaryKey(),
	name: text('name'),
	isDirectMessage: boolean('is_direct_message').notNull().default(false),
	createdBy: integer('created_by')
		.notNull()
		.references(() => users.id)
});

export const chatChannelMembers = pgTable(
	'chat_channel_members',
	{
		channelId: integer('channel_id')
			.notNull()
			.references(() => chatChannels.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.channelId, table.userId] })]
);

export const chatMessages = pgTable('chat_messages', {
	id: serial('id').primaryKey(),
	channelId: integer('channel_id')
		.notNull()
		.references(() => chatChannels.id, { onDelete: 'cascade' }),
	senderId: integer('sender_id')
		.notNull()
		.references(() => users.id),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	editedAt: timestamp('edited_at', { withTimezone: true })
});

// ---------------------------------------------------------------------------
// Clock in/out
// ---------------------------------------------------------------------------

export const clockEntries = pgTable('clock_entries', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	clockIn: timestamp('clock_in', { withTimezone: true }).notNull(),
	clockOut: timestamp('clock_out', { withTimezone: true }),
	notes: text('notes'),
	date: date('date').notNull()
});

// ---------------------------------------------------------------------------
// Word -> PDF converter
// ---------------------------------------------------------------------------

export const docConversions = pgTable('doc_conversions', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	originalFilename: text('original_filename').notNull(),
	originalType: text('original_type').notNull(),
	convertedType: text('converted_type').notNull(),
	storagePath: text('storage_path'),
	status: docConversionStatusEnum('status').notNull().default('pending'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
