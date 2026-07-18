# Roadmap and Next Steps

This roadmap tracks Metal Marines Reborn from a playable Canvas prototype toward a remake that **looks and plays like an upgrade over 1993 Metal Marines**, while keeping subterranean and ecological systems as mid-campaign expansions.

## Acceptance criteria

### Looks like a remake
- [x] Terrain, core buildings (HQ, Energy, Missile, Mech Bay, AA, Gun Pod), and mechs use sprite atlases in combat (not glyph/procedural shapes as the primary look)
- [x] Faction identity: player red/white, enemy gold/purple
- [x] Missiles / explosions / mech drops have sprite or flipbook battlefeel (not circles alone)
- [x] HUD and battlefield read as the same product

### Plays like better Metal Marines
- [x] Multi-base (up to 3 HQs): lose only when the last player base falls; enemy defeat when all enemy bases are gone
- [x] Gun Pods as first-class land defense
- [x] Gunner I / II with NORMAL / Anti-MMR / Anti-POD weapon modes
- [x] Factory speeds construction
- [x] Dummy Base / Dummy Cover for decoy and concealment
- [x] AA hit chance stacks with Radar (+5% per radar, cap 100%)
- [x] ICBM silo uses a 3×3 footprint that must remain intact to fire
- [x] Campaign depth toward ~20 operations with rising difficulty
- [x] Tunnels / ecology unlock as optional mid-campaign tech (not the opening fantasy)

## Active sequence

### Phase 0 — Tooling green + docs
- Fix aggregate typecheck blockers
- Keep this roadmap aligned with the visual → pillars → teach/balance sequence

### Phase 1 — Battlefield sprites (highest leverage)
- Ship atlas PNGs under `artifacts/metal-marines/public/game-assets/`
- Expand `manifests/core.json` for all building types
- Renderer uses sprites first; procedural fallback remains
- 64px tiles; faction color chrome

### Phase 2 — Battlefeel
- Projectile sprites, explosion/smoke flipbooks, building state frames
- Sample-based SFX for launch / hit / land / defeat

### Phase 3 — Original gameplay pillars
- Multi-base, Gun Pods, Gunner I/II + weapon modes, Factory, Dummy Base/Cover
- Radar-stacked AA, ICBM 3×3 footprint, assault cadence polish
- Expand campaign missions

### Phase 4 — Teach and balance
- Update HowToPlay + mission briefings (M1 + Theater Command teach pass done)
- [x] Balance costs / AI so idle missions are not instant defeat (attack grace + ECO phase gate)
- Determinism / regression checks (`test:game`, seeded init)

### Phase 5 — Presentation layer (in progress)
- [x] Campaign Theater meta-map (`/campaign`) with sector nodes + intel panel
- [x] Art upgrade pass: identity-board palettes, isometric building blocks, HF/Cursor hero overlays
- [x] Core hero set: HQ, Energy, Radar, Missile/ICBM, Turret, Gun Pod, AA, Factory, Supply, Mech + enemy recolors
- [x] Platform-pad terrain, building shadows/pads, larger mechs with M.MARINE callouts, build-palette icons
- [x] Systems heroes: Jammer + Tunnel Gate (+ enemy recolors)
- [x] Battlefeel: animated water shimmer, stronger shoreline foam, softer fog
- [x] Ecology heroes: Seismic, Destabilizer, Weather, Biosphere (+ enemy recolors)
- [x] Richer layered synthesized SFX (sample hot-swap still later)
- [x] Terrain sheet slices + EMP/Dummy heroes + denser HQ/airspace read
- [x] Sample banks for launch / explode / land hot-swapped behind `sfx()`
- See `AGENTS.md` backlog for Automation-driven next picks.
- [x] Vehicles / aircraft sprites (gameplay stubbed; atlas hot-swappable)
- [x] Factory garrison APCs + assault gunships (spawn/combat wired)
- [ ] True isometric camera (optional)
- [ ] Multiplayer / replay foundation

## Validation commands

```bash
pnpm --filter metal-marines typecheck
pnpm --filter metal-marines build
pnpm --filter metal-marines test:game
```

Full workspace:

```bash
pnpm run typecheck
pnpm run build
```
