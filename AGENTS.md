# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm monorepo (see `README.md` for the layout and the canonical build/run
commands). The primary product is the **Metal Marines 2026** browser RTS game in
`artifacts/metal-marines`. Standard commands live in `README.md`, `docs/ROADMAP.md`,
and each package's `package.json` — prefer those; the notes below only cover
non-obvious caveats discovered while setting up this environment.

### Toolchain / environment
- Node: the VM pins **Node v22.14.0** on `PATH` via `/exec-daemon`, which takes
  precedence over `nvm` even after `nvm use`. `README.md` says "Node.js 24", but
  22.14 satisfies every package here (Vite 7 needs ≥22.12) and is what actually runs.
  Don't expect `nvm use 24` to change the `node` resolved in shells.
- `pnpm` (v10.33.3) lives under the nvm dir and is symlinked at `/usr/local/bin/pnpm`
  so it resolves in login/tmux shells too. Just run `pnpm ...`.

### Aggregate typecheck/build is currently red (pre-existing code bug)
- `pnpm run typecheck` and `pnpm run build` (which runs typecheck first) FAIL on a
  pre-existing source typo: `ctx.createConicalGradient` in
  `artifacts/metal-marines/src/components/hud/RadarPanel.tsx` (should be
  `createConicGradient`; it's dead code that resolves to `null` either way).
- This does NOT block development: `vite dev`/`vite build` don't typecheck, so the
  game and sandbox run and build fine per-package. `pnpm --filter @workspace/api-server`,
  `@workspace/mockup-sandbox`, and `scripts` typecheck cleanly.

### Running the services (dev)
- Game: `pnpm --filter metal-marines dev` — `PORT` defaults to 5000, host `0.0.0.0`.
- Mockup sandbox: `pnpm --filter @workspace/mockup-sandbox dev` — its `vite.config.ts`
  THROWS unless BOTH `PORT` and `BASE_PATH` are set, e.g.
  `PORT=5002 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox dev`.
- API server: `PORT=5001 pnpm --filter @workspace/api-server dev`. Its `dev` script
  does a one-shot esbuild `build` then `start` (NOT hot-reloading — re-run after
  changes). It requires `PORT`. The `/api/healthz` route does not need a database.
- DB: `pnpm --filter @workspace/db run push` requires `DATABASE_URL` (Postgres). No
  database is provisioned in this environment, so DB push is out of scope unless one
  is added via secrets.

### Testing the game
- Determinism smoke test: `pnpm --filter metal-marines test:game`.
- Gameplay caveat: this is a real-time RTS. An idle player's HQ is destroyed within
  ~8 seconds of entering combat (`checkWinLoss` in `src/game/engine.ts`). When
  manually testing combat, act quickly — don't leave the combat screen idle.
