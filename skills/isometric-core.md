# Isometric Core Implementation Guide

Use this guide when modifying the tactical simulation, pathfinding, or renderer integration for Metal Marines Reborn.

## Core Rules

- Treat the simulation as authoritative. Renderer objects must mirror `RuntimeState`; they must not become gameplay state.
- Keep the camera fixed to a readable isometric view. Do not introduce free-camera gameplay.
- All simulation choices that affect gameplay must be deterministic from `RuntimeState.rngSeed`.
- Do not call `Math.random()` from engine systems. Use the seeded RNG helpers.
- Keep helpers pure where practical so pathfinding, cost scaling, AI scoring, and procedural map validation can be tested.

## Coordinate Spaces

- Tile coordinates are integer grid positions: `{ x: 0..GRID_W-1, y: 0..GRID_H-1 }`.
- World coordinates are pixel/scene positions centered on tiles via `tileToWorld(side, x, y)`.
- Player and enemy islands have distinct world-space origins. Always convert through `tileToWorld`, `worldToTile`, and `islandOriginX` rather than duplicating math.
- A path is a sequence of tile coordinates. Movement follows tile-center waypoints converted to world coordinates.

## Passability

A tile is pathable for mechs only when all conditions are true:

1. The tile is inside the island bounds.
2. Terrain is not `WATER`.
3. Terrain is not `MOUNTAIN` unless a future unit explicitly supports mountain traversal.
4. A live structure does not block the tile, except the final target tile may be treated as attackable rather than walkable.
5. Temporary blockers, disabled zones, or future procedural hazards are respected.

Recommended terrain costs:

- `GRASS`: 1.0
- `FOREST`: 1.5
- `MOUNTAIN`: blocked
- `WATER`: blocked

## A* Pathfinding

- Use Manhattan or octile distance depending on allowed movement. Start with 4-way movement for deterministic readability.
- Tie-break consistently, e.g. neighbor order: north, east, south, west.
- Cap pathfinding work per request to avoid frame spikes.
- Cache paths on the `Mech` state with target id and target tile.
- Re-path when:
  - target changes,
  - the next waypoint becomes blocked,
  - the mech has been stuck for a short deterministic threshold,
  - a structure is destroyed or built on the path.
- If no path exists, let the mech attack an adjacent reachable structure if possible; otherwise idle or select a different target.

## Mech Movement Contract

- `tickMechs` should not move directly by target vector except as waypoint following.
- Per tick:
  1. Validate current target.
  2. Acquire target if missing.
  3. Ensure path exists or request A*.
  4. Move toward the next waypoint by `MECH_SPEED * dt`.
  5. Snap to waypoint when the step would overshoot.
  6. Attack when within attack range of target world center.

## Determinism

- Use `state.rngSeed` and seeded helpers for:
  - particle variation,
  - AI choices,
  - AA interception chance,
  - procedural generation,
  - tie-breaking when needed.
- Prefer sorted arrays and stable scoring over randomized selection.
- Seeded simulations should produce identical action sequences for the same mission seed and inputs.

## Renderer Boundary

- Three.js should expose lifecycle methods similar to:
  - `createRenderer(container)`
  - `resizeRenderer(width, height)`
  - `syncRenderer(runtime, hover, time)`
  - `disposeRenderer()`
- Renderer sync may create, update, and delete meshes keyed by entity ids.
- Never mutate `RuntimeState` from renderer sync.
- Pointer mapping must round-trip through the same tile/world functions used by the engine.

## Testing Checklist

- Path from mech landing tile to HQ around water.
- No path through water or mountains.
- No path through live structures except target attack adjacency.
- Deterministic path selection when two routes have equal cost.
- Re-path after a blocking building is destroyed.
- Same seed produces same AI action order and procedural terrain.
