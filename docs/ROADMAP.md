# Roadmap and Next Steps

This roadmap reflects the current Metal Marines Reborn state after subterranean warfare and ecological warfare were added.

## Immediate next steps

### 1. Gameplay balance pass

Focus on tuning the new Phase 6–7 systems through real playtests.

Recommended checks:

- `TUNNEL_ENTRANCE` cost/build time versus rush potential
- `SEISMIC_SENSOR` detection range and alert frequency
- `TUNNEL_BUSTER` cost, speed, and collapse radius
- `TERRAIN_DESTABILIZER` cooldown and toxic sludge duration
- `WEATHER_CONTROL` cooldown, duration, and event strength
- `BIOSPHERE_ENGINE` repair and economy bonus values
- AI build frequency for tunnel/ecology tech

### 2. Player-facing tutorial updates

Update in-game help and mission briefings so players understand:

- Surface versus tunnel view
- Tunnel gates and underground mech movement
- Seismic detection and tunnel busters
- Toxic sludge terrain
- Dust storm, flood, and tremor effects
- Biosphere support mechanics

Primary files:

- `artifacts/metal-marines/src/pages/HowToPlay.tsx`
- `artifacts/metal-marines/src/data/missions.ts`
- `artifacts/metal-marines/src/components/hud/BuildPalette.tsx`

### 3. Phase 7 polish

Potential polish items:

- Improve weather visuals and add sound effects
- Add radar overlays for enemy-side ecological hazards when revealed
- Add clearer hover/tooltip descriptions for new buildings
- Add alert throttling for repeated seismic/ecology warnings
- Add battlefield particles for terrain mutation and weather activation

### 4. Regression and determinism checks

The engine relies on seeded randomness for simulation decisions. Before multiplayer/replay work, verify that recent systems remain deterministic.

Recommended checks:

- Avoid `Math.random()` in simulation code
- Keep weather and terrain mutation driven by seeded RNG
- Add smoke tests for seeded mission initialization
- Add replay-like command-log validation before networked multiplayer

### 5. Technical cleanup

Recommended cleanup tasks:

- Investigate the existing Vite sourcemap warning in `src/components/ui/tooltip.tsx`
- Add lightweight automated tests for `pathfinding.ts` and core engine helpers
- Document code conventions for game systems
- Consider splitting large `engine.ts` sections into focused modules once behavior stabilizes

## Medium-term feature candidates

### Meta-map/campaign layer

- Strategic territory map
- Persistent commander progression
- Mission modifiers based on conquered regions
- Resource bonuses or constraints by territory

### Multiplayer/replay foundation

- Deterministic command log
- Frame hash validation
- Replay save/load
- Lockstep simulation prototype

### AI improvements

- Commander-specific AI personalities
- Better counter-build detection
- Ecology-aware targeting
- Tunnel assault planning instead of opportunistic tunnel use

### UX improvements

- Build hotkey overlay
- In-game codex for units/buildings/weather
- Better mission-complete statistics
- Accessibility review for color-only indicators

## Validation commands

Use these after gameplay or UI changes:

```bash
pnpm --filter metal-marines typecheck
pnpm --filter metal-marines build
```

Use these before broad repo handoff:

```bash
pnpm run typecheck
pnpm run build
```
