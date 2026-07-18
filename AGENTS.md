# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm monorepo (see `README.md` for layout and canonical commands). The
primary product is the **Metal Marines 2026** browser RTS in
`artifacts/metal-marines`. Prefer `README.md`, `docs/ROADMAP.md`, and each
package's `package.json` for standard scripts — notes below cover non-obvious
caveats only.

### Toolchain / environment
- Node: the VM may pin **Node v22.14.0** via `/exec-daemon`, which can take
  precedence over `nvm`. Vite 7 needs ≥22.12; 22.14 is fine even if README
  mentions Node 24.
- Use **pnpm** for all installs and scripts.

### Running services (dev)
- Game: `pnpm --filter metal-marines dev` — `PORT` defaults to 5000.
- Mockup sandbox: requires **both** `PORT` and `BASE_PATH`, e.g.
  `PORT=5002 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox dev`.
- API server: `PORT=5001 pnpm --filter @workspace/api-server dev` (build-then-start,
  not hot reload). `/api/healthz` does not need a database.
- DB: `pnpm --filter @workspace/db run push` needs `DATABASE_URL` (Postgres).

### Game assets
- Combat sprites load from `artifacts/metal-marines/public/game-assets/` via
  `manifests/core.json` (hot-swappable atlases).
- Regenerate atlases: `python3 scripts/generate-game-atlases.py`
  (uses hero overlays in `public/game-assets/heroes/` when present).
- Campaign theater backdrop: `public/campaign/theater.jpg`.

### Testing
- Determinism smoke test: `pnpm --filter metal-marines test:game`.
- Typecheck / build: `pnpm --filter metal-marines typecheck` and `build`.
- Gameplay caveat: idle HQs fall quickly in real-time combat — act promptly when
  manually testing the Play screen.
