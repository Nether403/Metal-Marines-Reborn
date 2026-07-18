# AGENTS.md

## Continuous improvement (Automations)

A Cursor Automation is configured to run on **PR merged** into this repo.
Each run must:

1. Read this file + Memories (last shipped / next / blockers).
2. Pick **ONE** highest-priority unfinished backlog item that fits a single PR.
3. Implement + verify (`pnpm --filter metal-marines typecheck`, `test:game`, `build`).
4. Open **one focused PR** (do not wait for a human nudge).
5. Update Memories: what shipped, what's next, what blocked.

Do **not** ask the human to continue. If nothing high-value remains, do nothing
and record why in Memories.

### Visual north star
- Primary: readable like **1993 Metal Marines** — strong silhouettes, green
  islands, chunky mechs, dense bases when built up.
- Aspirational: modern isometric remake fidelity (do not block on photoreal).
- Prefer hot-swapping atlases under `artifacts/metal-marines/public/game-assets/`
  over engine rewrites. Stay top-down grid unless a dedicated isometric milestone.

### Backlog (pick top unfinished)

#### P0 — Battlefield still feels sparse / soft
1. [x] Forest tiles: denser canopy clumps that read as trees at combat zoom (not
      green blobs). Regenerate terrain atlas; hard-refresh proof screenshot.
2. [ ] Building damaged/construction/disabled states: hero-quality frames (not
      just tint overlays) for HQ, Energy, Missile, Turret at minimum.
3. [ ] Projectile + FX atlas upgrade: thicker missiles, bigger explosion flipbooks,
      visible mech drop pods (battlefeel vs SNES remake).
4. [ ] Mech walk/fight frames: distinct poses from hero art (not rotate/tint of idle).

#### P1 — Product polish
5. [ ] HowToPlay + Mission 1 briefing refresh for Theater Command + new buildings.
6. [ ] Build palette: category tabs or scroll polish so 20+ buildings don't feel
      like a wall of chips on short viewports.
7. [ ] Enemy island: when fog lifts, enemy hero buildings must read gold/purple
      clearly (verify recolor quality at combat scale).

#### P2 — Later / optional
8. [ ] Sample-based SFX banks (launch / explode / land) hot-swapped behind `sfx()`.
9. [ ] Vehicles / aircraft sprites (gameplay can stub later).
10. [ ] True isometric camera (large refactor — only after P0 feels solid).
11. [ ] Multiplayer / replay foundation.

When completing an item, mark it `[x]` here in the same PR when practical.

---

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
- After atlas changes, hard-refresh the browser (`Ctrl+Shift+R`) — Vite can cache PNGs.

### Testing
- Determinism smoke test: `pnpm --filter metal-marines test:game`.
- Typecheck / build: `pnpm --filter metal-marines typecheck` and `build`.
- Gameplay caveat: idle HQs fall quickly in real-time combat — act promptly when
  manually testing the Play screen.
