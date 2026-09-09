# syntax=docker/dockerfile:1

# --- Build stage -------------------------------------------------------
# Compiles the SvelteKit app. LibreOffice isn't needed here — it's only
# invoked at request time by the Word→PDF converter, never during the
# build — so keeping it out of this stage keeps the build fast, and
# multi-stage means it never ends up duplicated in the final image either.
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `vite build` imports src/lib/server/db/index.ts as part of bundling the
# server code, and that module throws immediately if DATABASE_URL isn't
# set — even though the build never actually connects to a database. This
# placeholder only needs to be a syntactically parseable connection
# string; it is never used to reach a real database at build time, and the
# real DATABASE_URL is supplied at runtime via Render's environment
# variables (see the deployment notes).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run build

# Drop devDependencies (vite, svelte-check, typescript, drizzle-kit, ...)
# before copying node_modules into the runtime stage below.
RUN npm prune --omit=dev

# --- Runtime stage -------------------------------------------------------
FROM node:22-slim
WORKDIR /app

# LibreOffice, for the Word→PDF converter (libreoffice-convert shells out to
# the `soffice` binary at request time). This is the single biggest
# contributor to the final image size — there's no way around that with
# real .docx→PDF conversion — so --no-install-recommends and clearing the
# apt cache afterward are the only real levers available.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libreoffice \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

ENV NODE_ENV=production
# Render sets PORT itself at runtime and routes traffic to it — this is
# just the local default adapter-node falls back to if PORT isn't set
# (e.g. running the image outside Render). Never hardcode a port in code.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build/index.js"]
