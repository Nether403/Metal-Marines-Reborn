# Metal Marines Reborn
<img width="1013" height="568" alt="image" src="https://github.com/user-attachments/assets/91529f12-cf2f-4325-9fe4-e358920d8404" />

Metal Marines Reborn is a TypeScript/pnpm monorepo centered on **Metal Marines 2026**, a browser-based real-time strategy game built with React, Vite, Zustand, and HTML5 Canvas.

The playable game lives in `artifacts/metal-marines` and includes campaign missions, procedural skirmishes, missile warfare, mech drops, subterranean combat, and ecological warfare systems.

## Repository layout

```text
.
├── artifacts/
│   ├── api-server/        # Express API server
│   ├── mockup-sandbox/    # Vite design/mockup sandbox
│   └── metal-marines/     # Main RTS web game
├── lib/
│   ├── api-client-react/  # Generated API client/hooks
│   ├── api-spec/          # OpenAPI spec + Orval config
│   ├── api-zod/           # Generated Zod API types
│   └── db/                # Drizzle/PostgreSQL package
├── scripts/               # Workspace scripts
├── skills/                # Project-specific skill/reference docs
├── package.json           # Root workspace commands
└── pnpm-workspace.yaml    # pnpm workspace + catalog config
```

## Main game: `artifacts/metal-marines`

### Stack

- React 19
- Vite 7
- TypeScript 5.9
- Zustand for runtime state
- Wouter for routing
- HTML5 Canvas renderer
- Tailwind-style utility classes and Radix UI components

### Routes

- `/` — home screen
- `/missions` — campaign mission select
- `/play/:id` — combat screen
- `/how-to-play` — player manual

### Core source areas

- `src/game/types.ts` — game model and runtime types
- `src/game/constants.ts` — tuning, dimensions, unit/building specs
- `src/game/engine.ts` — deterministic simulation tick, combat, AI
- `src/game/pathfinding.ts` — layer-aware pathfinding
- `src/game/renderer.ts` — Canvas 2D renderer
- `src/game/store.ts` — Zustand store, mission initialization, save/load
- `src/data/missions.ts` — campaign definitions and procedural mission entry
- `src/components/hud/` — combat HUD
- `src/pages/` — route-level React pages

## Gameplay features

### Combat layer

- Real-time island-vs-island RTS combat
- Missile launcher, ICBM, dummy missiles, AA interceptors, EMP strikes
- Metal Marine drops and ground assaults
- Radar, jamming, fog/reveal, alerts, projectiles, explosions, and camera shake
- AI economy, defense, probing, assault, and countermeasure decisions

### Subterranean warfare

- `TUNNEL_ENTRANCE` opens underground movement networks
- `SEISMIC_SENSOR` detects underground contacts
- `TUNNEL_BUSTER` collapses tunnel cells and destroys underground units
- Surface/underground view toggle with `V`
- Layer-aware pathfinding and rendering

### Ecological warfare

- `TERRAIN_DESTABILIZER` mutates enemy terrain into temporary toxic sludge
- `WEATHER_CONTROL` triggers dust storms, floods, or tremors
- `BIOSPHERE_ENGINE` improves nearby economy and supports regeneration/repair
- `TOXIC_SLUDGE` blocks surface movement and construction while active
- Weather affects movement and defensive reliability
- HUD/radar/renderer overlays show environmental state

## Requirements

- Node.js 24
- pnpm

The workspace enforces pnpm via `preinstall` and uses `minimumReleaseAge` in `pnpm-workspace.yaml` as supply-chain protection.

## Setup

```bash
pnpm install
```

## Common commands

From the repository root:

```bash
pnpm run typecheck
pnpm run build
```

Run only Metal Marines:

```bash
pnpm --filter metal-marines typecheck
pnpm --filter metal-marines test:game
pnpm --filter metal-marines build
pnpm --filter metal-marines dev
pnpm --filter metal-marines serve
```

API and schema commands:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

## Development workflow

1. Install dependencies with `pnpm install`.
2. Start the game with `pnpm --filter metal-marines dev`.
3. Edit game logic in `artifacts/metal-marines/src/game`.
4. Validate with:
   - `pnpm --filter metal-marines typecheck`
   - `pnpm --filter metal-marines build`
5. Use full workspace checks before larger handoffs:
   - `pnpm run typecheck`
   - `pnpm run build`

## Save data

The game stores browser-local progress and snapshots in `localStorage`:

- `mm2026.progress.v1` — cleared missions and best times
- `mm2026.save.v1` — active mission snapshot

## Current validation status

As of May 5, 2026:

- `pnpm run build` passes
- `pnpm --filter @workspace/mockup-sandbox build` passes
- `pnpm --filter metal-marines test:game` passes
- `pnpm --filter metal-marines typecheck` passes
- `pnpm --filter metal-marines build` passes

## Suggested next work

See `docs/ROADMAP.md` for prioritized next steps.
