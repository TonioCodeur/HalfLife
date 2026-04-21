@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project intent

`halflife` is a web app for computing the half-life of a drug or molecule (pharmacokinetic decay). The product surface is a single Next.js App Router page; there is no backend, database, or auth yet — calculations should run client-side unless a future feature requires otherwise.

Current state: the repo is still the unmodified `create-next-app` boilerplate (`app/page.tsx` shows the Next.js splash). Treat any new code as the first feature implementation, not a modification of existing logic.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`, `pnpm-workspace.yaml`). Do not introduce `npm install` / `yarn` lockfiles.

- `pnpm dev` — start the dev server (http://localhost:3000)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — ESLint (flat config, `eslint.config.mjs`)

There is no test runner configured. If you add tests, propose the framework choice before installing.

## Stack constraints (newer than typical training data)

- **Next.js 16.2.4** with the App Router. The `AGENTS.md` rule applies: before writing routing, data-fetching, caching, server-action, or middleware code, read the relevant page under `node_modules/next/dist/docs/01-app/` and respect deprecation notices. APIs that were stable in Next 14/15 may have moved or changed signature.
- **React 19.2.4** — assume the new compiler-friendly hooks and `use()` are available; do not pull in patterns that React 19 has retired.
- **Tailwind CSS v4** — config-less. Theme tokens live in `app/globals.css` via `@import "tailwindcss"` and `@theme inline { … }`. Do not create a `tailwind.config.{js,ts}` file.
- **TypeScript strict** with path alias `@/*` → repo root (e.g. `@/app/lib/foo`).

## Layout conventions already in place

- `app/layout.tsx` wires the Geist Sans/Mono fonts via `next/font/google` and sets `<html>`/`<body>` to a flex column that fills the viewport. New pages should slot into that flex layout (`flex-1`) rather than re-declaring full-height containers.
- Dark mode is driven by `prefers-color-scheme` in `app/globals.css` and per-component `dark:` Tailwind variants — there is no theme toggle component.
