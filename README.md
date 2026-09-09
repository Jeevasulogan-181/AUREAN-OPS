# Ops Hub

Internal operations app — SvelteKit (Svelte 5 runes) + Neon Postgres + Drizzle ORM +
Lucia-style DB-backed sessions + Tailwind CSS.

**Status:** All 9 original modules are built — Auth, Staff Management, Clock In/Out,
Tasks, Projects, Calendar, Reminders, Drive, Word→PDF, and Chat — plus a Notes module
added afterward.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a [Neon](https://neon.tech) project and copy its connection string, then:

   ```bash
   cp .env.example .env
   ```

   Fill in `DATABASE_URL`, and pick `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` /
   `SUPERADMIN_EMAIL` for the first account.

3. Push the schema to your database:

   ```bash
   npm run db:generate   # writes SQL migration files to ./drizzle
   npm run db:migrate    # applies them
   ```

4. Seed the superadmin account (safe to re-run — skips if the user already exists):

   ```bash
   npm run db:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Log in at `/login` with `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`.

6. **Word → PDF requires LibreOffice installed locally** (the converter shells out to
   `soffice` via the `libreoffice-convert` package — there's no bundled/serverless
   LibreOffice here). Install it before using `/convert`:

   - **Windows:** download and run the installer from
     [libreoffice.org](https://www.libreoffice.org/download/download/), or
     `winget install TheDocumentFoundation.LibreOffice`
   - **macOS:** `brew install --cask libreoffice`
   - **Linux (Debian/Ubuntu):** `sudo apt install libreoffice`

   The dev server (and wherever this eventually gets deployed) needs `soffice` on its
   `PATH`. This won't work on a typical serverless platform (Vercel included) without a
   custom container/buildpack that bundles LibreOffice — fine for this prototype running
   via `npm run dev` on a machine that has it installed, but worth flagging before this
   goes further.

## What's here

- `src/lib/server/db/schema.ts` — Drizzle schema for every table in the spec (users,
  sessions, projects, tasks, calendar, reminders, drive, chat, clock entries, doc
  conversions). All of it is wired up to actual features now.
- `src/lib/server/auth/` — password hashing (argon2id) and DB-backed sessions (random
  token in an httpOnly cookie, only its SHA-256 hash stored server-side — same pattern
  as Lucia's session guide, so a leaked DB row can't be replayed as a cookie).
- `src/hooks.server.ts` — attaches `event.locals.user` / `event.locals.session` on
  every request.
- `src/routes/(auth)/login` — login page + form action.
- `src/routes/(app)` — authenticated shell (sidebar nav) + auth guard + dashboard +
  forced change-password flow for first login / after an admin resets a password.
- `src/routes/(app)/(admin)/staff` — superadmin-only "Manage Staff": create employees
  (temp password shown once), change role, reset password, activate/deactivate.
- `src/routes/(app)/clock` — clock in/out for the signed-in user; `admin`/`superadmin`
  also get a filterable all-staff history section on the same page.
- `src/routes/(app)/tasks` — kanban board (drag-and-drop) + list view, create/assign/edit,
  due date + priority.
- `src/routes/(app)/projects` + `.../projects/[id]` — project list and detail (tasks +
  team members, add/remove members, status).
- `src/routes/(app)/calendar` — month view, create events with private/team/company
  visibility, invite staff, accept/decline. "Team" visibility uses `users.department`
  (there's no separate team/department table in the schema).
- `src/routes/(app)/reminders` — personal reminders, optional link to one of the user's
  own tasks; sidebar shows a due-today-or-overdue count badge.
- `src/routes/(app)/notes` — personal notes (title + free-text content), strictly
  private like Reminders: no admin/manager override anywhere, ownership re-checked in
  every action. Added after the original 9-module spec — see `drizzle/0001_*.sql`.
- `src/routes/(app)/drive/[[folderId]]` — folder browser (breadcrumb, create folder,
  upload, delete), `src/routes/(app)/drive/download/[fileId]` — download endpoint.
  `src/lib/server/fileStorage.ts` is the storage abstraction (see "Notes" below).
- `src/routes/(app)/convert` — Word→PDF converter; `src/lib/server/convertDocument.ts`
  wraps `libreoffice-convert` with a timeout and typed errors.
- `src/routes/(app)/chat/[[channelId]]` — group channels + 1:1 DMs, polling-based
  message refresh, edit-your-own-message-within-a-window. See "Notes" below for the
  polling and permission model.
- `scripts/seed.ts` — creates the superadmin from env vars.

## Notes / decisions

- **Adapter:** `@sveltejs/adapter-node` — builds a plain Node server (`build/index.js`)
  that runs in any container, which is what the Docker/Render deploy runs. (This project
  started on `adapter-auto`/Vercel defaults; switched over for the Docker deploy — see
  "Deploying to Render" below.)
- **IDs:** serial integers everywhere except `sessions.id`, which is the session
  token's hash (text).
- **Roles:** `superadmin > admin > employee`. Only `superadmin` can reach `/staff`
  right now, per the spec ("Superadmin has a Manage Staff screen"); the `admin` role
  exists and is assignable but has no elevated screens wired up yet — extend
  `(app)/(admin)/+layout.server.ts`'s check when that's needed.
- **DB driver:** `drizzle-orm/neon-http` (one-shot HTTP queries — works well in
  serverless/edge; no persistent connection to manage).
- **Action-level permission checks:** every mutating action re-checks role/ownership
  itself rather than trusting the parent route's `load` — for a POST to a form action,
  SvelteKit runs the action before it re-runs `load` to build the response, so a
  redirect/error thrown from `load` fires too late to stop a mutation that already ran.
- **File storage is a Postgres-bytea prototype, deliberately swappable.** `files.content`
  (bytea) holds file bytes directly in Neon; `src/lib/server/fileStorage.ts` is the only
  module that reads/writes it (`saveFile`/`getFile`/`deleteFile`, keyed by an opaque
  `storagePath` string). Moving to Vercel Blob/R2/S3 later means rewriting only that file.
  Trade-offs of the current backend: whole files load into memory per request, Postgres
  storage/egress cost scales with file size, and uploads are capped at 10MB
  (`MAX_UPLOAD_BYTES` in `src/routes/(app)/drive/shared.ts`) to keep that reasonable. Note
  that Vercel's own serverless functions cap request bodies well under 10MB by default
  regardless of this app-level check — fine for local dev, worth revisiting before a
  Vercel deploy.
- **Drive sharing:** `folders.shared_with` (jsonb — user ids, or the literal string
  `"company"`) controls *view* access only; write access (upload/create-subfolder/delete)
  is owner + admin/superadmin only, never granted by sharing. Root-level files (no
  folder) have no sharing concept and are owner-only. Deleting a folder cascades to its
  subfolders but only *unfiles* the files inside (`files.folder_id` is `ON DELETE SET
  NULL`) — files move to their owner's root rather than being deleted.
- **Word→PDF conversions are stored as ordinary Drive files** (owned by whoever
  converted them, no folder) — see the LibreOffice setup note above for why this needs a
  local LibreOffice install.
- **Chat uses polling, not WebSockets/SSE.** `[[channelId]]/+page.svelte` calls
  `invalidate('app:chat-messages')` on a 4-second interval while a channel is open,
  which re-runs the load function's DB query. Simple and reliable for a prototype, but
  it means up to ~4s of lag and a DB query every few seconds per open tab. If that lag
  feels bad in practice, or the polling load becomes a real cost at any scale, swapping
  in SSE (a `+server.ts` streaming endpoint) or WebSockets is the natural next step —
  no schema changes needed either way, just the delivery mechanism.
- **Chat visibility/write model:** a channel (group or DM) is only visible to its
  members — `load` and every action re-check membership independently, same pattern as
  everywhere else. DMs are exactly 2 members, fixed at creation; `addMember` explicitly
  refuses to add anyone to a DM. Creating a DM reuses an existing one between the same
  two people rather than making a duplicate. Message edits are allowed only by the
  original sender and only within 15 minutes of sending (`EDIT_WINDOW_MS`).

## Deploying to Render (Docker)

The `Dockerfile` is a two-stage build: the first stage runs `npm ci` + `npm run build`
(no LibreOffice needed there — nothing at build time invokes the converter); the second,
final stage installs LibreOffice and copies in only the built `build/` output and
production `node_modules`. This keeps the image from carrying Vite/TypeScript/etc.
twice, but LibreOffice itself is unavoidably large — **the final image is about 1.1GB**,
almost entirely LibreOffice's own dependency tree (verified with a local `docker build`
+ `docker images`).

**Environment variables to set in Render's dashboard** (Render → your service →
Environment — never commit these):

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | the same pooled connection string already in your local `.env` | Points at the existing `ops-hub-devtest` Neon project — no new database needed, and no migration to run, since that project already has the current schema applied (through Phase 5). Neon is reachable over plain internet access; nothing special is needed on Render's side for that. |
| `ORIGIN` | `https://<your-render-service-name>.onrender.com` | **Required, easy to miss.** SvelteKit checks the request's `Origin` header against this for every POST (i.e. every form action in this entire app — login, every create/edit/delete button) as CSRF protection. Render terminates TLS and proxies to your container, so without this set explicitly the app doesn't know its own public HTTPS URL and **rejects every POST with a 403** — pages load, nothing you click works. Render's URL pattern is predictable: whatever you type as the service name becomes `https://that-name.onrender.com`, so you can set this correctly on first deploy. Update it if you ever add a custom domain. |
| `BODY_SIZE_LIMIT` | `15M` | **Required for uploads.** `adapter-node` defaults this to `512K` — verified locally: a 2MB upload gets a raw `413 Payload Too Large` from the adapter itself, before the app's own 10MB check (Drive uploads, Convert's .docx uploads) ever runs. `15M` clears the app's 10MB cap with headroom for multipart overhead. |

Not needed as Render env vars for this deploy: `SUPERADMIN_USERNAME`/`PASSWORD`/`EMAIL`
only matter to `scripts/seed.ts`, a one-off local script — the target database already
has its superadmin seeded, and the running server never reads these three. There's also
no `SESSION_SECRET` anywhere in this codebase to set: sessions are a random per-login
token whose SHA-256 hash is stored server-side (see `lib/server/auth/session.ts`), not
an HMAC scheme, so there's no server-side secret key involved at all.

`PORT` is set by Render itself at runtime and read automatically by `adapter-node` —
don't set it manually. `NODE_ENV=production` is already baked into the image.

**Creating the service:** New → Web Service → connect this repo (push it to GitHub or
GitLab first — Render deploys from a git remote, not a local folder) → Runtime: **Docker**
→ Dockerfile Path: `Dockerfile` (repo root, the default) → add the three env vars above →
Create. No start command override needed — the image's `CMD` handles it.

**What to expect on the free tier** (512MB RAM, spins down after ~15 minutes idle):

- **Cold starts are real and slow here specifically because of LibreOffice.** The base
  app boots in a couple seconds, but the first request after a spin-down will be slow
  (Render says up to ~60s+ is normal for a free-tier cold start pulling a >1GB image and
  starting the container) — this is expected, not broken.
- **Memory is the real risk, not CPU.** Idle, this container used ~35MB locally. A single
  Word→PDF conversion (tested locally against a real `.docx`, not just compiled)
  spiked it to **~155MB** — headless LibreOffice is genuinely memory-hungry to spin up.
  That's comfortable alone, but 512MB is the *total* ceiling for the Node process +
  LibreOffice + everything else on the box; a conversion landing while something else is
  already using meaningful memory, or two conversions overlapping, is where you'd expect
  to see an OOM kill rather than a graceful error. If that happens in practice, it'll
  look like the request just dies/times out rather than the app's own "conversion
  failed" message — worth knowing so it doesn't read as a mystery.
- **No persistent disk.** Not relevant to file storage here (files live in Neon
  Postgres, not on local disk), but worth knowing generally: anything written to the
  container's filesystem is gone on every restart/redeploy/spin-down.
- **Neon's own free-tier compute** also suspends after inactivity and takes a moment to
  wake — so a cold Render instance hitting a cold Neon compute on the very first request
  after a quiet period can stack both delays. Subsequent requests are fast once both are
  warm.

## Everything is built

All 9 modules from the original spec are done. Rough edges and follow-ups worth
revisiting are called out inline above (search "prototype", "swappable", or "worth
revisiting") rather than duplicated here.
