# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

Primary repository documentation now lives in `README.md`; forward-looking work is tracked in `docs/ROADMAP.md`.

## Artifacts

- `artifacts/api-server` — Express API server (kind: api).
- `artifacts/mockup-sandbox` — Vite mockup sandbox (kind: design).
- `artifacts/metal-marines` — **Metal Marines 2026**, real-time strategy
  web game (React + Vite + zustand + HTML5 Canvas) at preview path `/`.
  Routes: `/` home, `/missions` select, `/play/:id` combat, `/how-to-play`
  manual. Game engine + canvas renderer in `src/game/`, HUD components in
  `src/components/hud/`, missions in `src/data/missions.ts`. Local
  storage stores cleared-mission progress (`mm2026.progress.v1`).
  Current gameplay includes missile warfare, AA interception, EMP, radar
  jamming, Metal Marine drops, subterranean tunnels/seismic detection, tunnel
  busters, and ecological warfare with toxic terrain and weather events.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter metal-marines run dev` — run the Metal Marines Vite dev server
- `pnpm --filter metal-marines run typecheck` — typecheck only the game
- `pnpm --filter metal-marines run build` — production build only the game
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Current Validation Notes

- `pnpm --filter metal-marines typecheck` passes.
- `pnpm --filter metal-marines build` passes.
- The game build currently emits one non-fatal Vite sourcemap warning from `src/components/ui/tooltip.tsx`.
