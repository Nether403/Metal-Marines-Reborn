Metal Marines Reborn — Visual Modernization Plan
From functional prototype to concept-art fidelity.

The Gap
Current state: The renderer (renderer.ts, 501 lines) uses Canvas 2D with:

Flat fillRect color blocks for terrain (e.g., #0e3b2c for GRASS)
Single-character glyphs for buildings (e.g., "M" for Missile Launcher, "HQ" drawn as colored rectangles)
6-pixel rectangles for mechs
Simple circle particles for explosions
Monospace text labels for everything
Target state (from 16 concept art sheets in /Game-art):

Isometric 64×64px modular terrain tiles with cliff faces, shorelines, and elevation
Detailed building sprites with upgrade tiers, animation states (idle/firing/damaged)
Animated mech sprites with walk/attack/reload/die sequences
Vehicle sprites with per-faction silhouettes
Rich VFX: explosions (small/medium/large), smoke columns, muzzle flashes, debris, selection rings
HUD panels with dark metal aesthetic, high-contrast accents, and action-oriented layout
Fog-of-war with 12 distinct intel states and overlay effects
Faction color identity (Player = disciplined reds/whites, Enemy = aggressive gold/purple)
User Review Required
IMPORTANT

Art Asset Generation: The concept art sheets are reference boards, not production sprite sheets. We need to produce actual game-ready assets from them. Options:

AI Generation — Use the generate_image tool to create individual sprites inspired by the concept art (fastest, can be iterated)
Manual Extraction — Crop and process sub-regions from the concept boards (limited quality due to overlap/labels)
Placeholder → Replace — Build the sprite system with colored placeholders, letting you commission/create final art later
Recommendation: Option 1+3 hybrid — Generate key sprites with AI now, build the system so any sprite can be hot-swapped later.


Faction colors — Player = red/white metallic and Enemy = gold/purple/spiked.

WARNING

Isometric vs. Top-Down: The concept art shows isometric tiles (64×64px per the terrain board). The current renderer is flat top-down with a 12×10 grid at 44px per tile. Switching to true isometric requires reworking:

Tile coordinate math (diamond grid instead of rectangular)
Mouse hit-testing (isometric → grid coordinate conversion)
Building footprint logic
All pathfinding visuals
Recommendation: Stay top-down but use the isometric art style rendered onto rectangular tiles. This preserves all game logic and gives 80% of the visual impact at 20% of the refactor cost. True isometric can be a future milestone.

IMPORTANT

Canvas Size: Current world is 1236 × 500 px (two 528×440 islands + 180px gap). With richer art, we should consider increasing tile size to 64px (matching concept art), giving a 1692 × 700 world. This will make sprites more legible but requires adjusting the responsive canvas scaling in Play.tsx.

Open Questions
Tile size: Should we increase from 44px → 64px to match the concept art's tile spec? This changes GRID dimensions and all position math.
Faction colors: The identity board shows Player Faction as red-tinted and Enemy as gold/purple. Current code uses green=player, red=enemy. Should we match the concept art's faction palette or keep the current green/red?
Scope priority: Would you prefer to start with the HUD overhaul (immediately visible, no renderer changes) or the terrain/building sprites (deeper visual impact)?
Proposed Changes
Phase 1: Asset Pipeline & Sprite System
Foundation layer — enables all subsequent phases

[NEW] src/game/sprites.ts
SpriteAtlas class: loads a sprite sheet PNG, defines named regions (x, y, w, h)
AnimatedSprite class: frame sequences with timing, looping, one-shot modes
SpriteManager singleton: preloads all atlases, provides draw(ctx, spriteName, x, y, scale) API
Asset manifest: maps logical names ("building.hq.idle", "mech.walk.0") to atlas regions
Fallback: if a sprite isn't loaded, draws the current glyph/shape (graceful degradation)
[NEW] src/game/assets/ directory
Generated sprite PNGs for buildings, mechs, terrain tiles, VFX frames
One atlas per category: terrain-atlas.png, buildings-atlas.png, units-atlas.png, fx-atlas.png
JSON manifest files defining frame coordinates
[MODIFY] src/game/constants.ts
Add TILE_PX_NEW = 64 (or configurable)
Add sprite manifest imports
Recalculate ISLAND_PX_W, ISLAND_PX_H, WORLD_W, WORLD_H based on new tile size
Phase 2: Terrain & Island Rendering
Replace flat-color terrain with textured tiles

[MODIFY] src/game/renderer.ts — drawIsland()
Replace TERRAIN_FILL flat fillRect with sprite-based tile rendering
Draw terrain tiles from the terrain atlas instead of single colors
Add edge/transition blending between terrain types (grass↔water, grass↔mountain)
Add cliff shadow overlays for elevation changes
Replace water shimmer lines with animated water tile frames
Add shoreline transition sprites around island perimeter
Add subtle parallax for ocean background between islands
[MODIFY] src/game/renderer.ts — drawSeaBetween()
Replace sparse dots with a proper ocean rendering (animated wave tiles, depth gradient)
Add atmospheric haze/mist layer for depth perception
[NEW] src/game/renderer.ts — drawIslandShadow()
Cast shadow beneath each island to give the "floating fortress" feel from concept art
Phase 3: Building & Unit Sprites
Replace glyphs with actual building/unit art

[MODIFY] src/game/renderer.ts — drawBuilding()
Replace fillRect + glyph text with sprite rendering from buildings atlas
Draw different sprites based on building state:
Under construction (hologram/scaffold)
Active/Idle
Damaged (smoke particles, cracks)
EMP-disabled (blue electricity overlay)
Scale sprites to respect building footprint (1×1 vs 2×2 from concept art)
Add faction tinting (color multiply for player vs. enemy)
[MODIFY] src/game/renderer.ts — drawMech()
Replace 6px rectangles with animated mech sprites
Animation states: idle, walking (8 frames), attacking (6 frames), taking damage, dying
Direction-aware rendering (flip sprite based on movement direction)
Underground mechs: draw with scan-line overlay effect instead of just transparency
[MODIFY] src/game/renderer.ts — drawProjectile()
Replace circles with oriented missile/rocket sprites
Add proper smoke trail rendering with sprite-based puff particles
Transport pods: draw as actual drop-pod sprites with descent animation
EMP: blue energy sphere with electric arc effects
Phase 4: HUD & UI Overhaul
Match the dark metal panel aesthetic from the UI/HUD reference pack

[MODIFY] src/components/hud/ResourceBar.tsx
Redesign to match concept art's top bar: dark metal panel with faction insignia
"WAR FUNDS" with dollar icon, "ENERGY" with lightning bolt, both with animated bar fills
Sector name display (left)
Settings gear (right)
Color palette: dark slate background (#0f1923), cyan accents for energy, amber for funds
[MODIFY] src/components/hud/BuildPalette.tsx
Replace text-only buttons with thumbnail sprite previews
Two-tab system: "BUILD" | "DOCTRINES" (matching concept)
Sub-categories: BASE, DEFENSES, UNITS, AIR
Each item shows: sprite thumbnail, name, cost
Highlighted selection with glow border
"LAUNCH" button prominently placed (green, large)
[MODIFY] src/components/hud/RadarPanel.tsx
Minimap in top-left with proper terrain rendering (tiny versions of terrain sprites)
Fog-of-war overlay on minimap
"DETECTED BASE" markers in red
Intel lifecycle states from fog-intel concept sheet
[NEW] src/components/hud/MissionObjectives.tsx
Left panel showing current objectives with checkbox status
Matches concept art's "MISSION OBJECTIVES" panel
Collapsible, semi-transparent dark panel
[NEW] src/components/hud/UnitInfoPanel.tsx
Bottom-left panel showing selected unit/building details
HP bar, name, level, description
Training queue display (if applicable)
[MODIFY] src/index.css
New CSS custom properties for the HUD color scheme
Dark metal panel gradient backgrounds
Glow/scan-line effects for active elements
Custom scrollbar styling for panels
Phase 5: VFX & Polish
Explosions, smoke, selection rings, screen effects

[MODIFY] src/game/renderer.ts — drawParticle()
Replace circle particles with sprite-based VFX frames
Explosion sequences: small (4 frames), medium (6 frames), large (8 frames)
Smoke columns with fade and drift
Debris spray on building destruction
Muzzle flash on weapon fire
[NEW] src/game/renderer.ts — drawSelectionRing()
Animated dashed selection ring around selected units (from battleFeel sheet)
Color-coded: green=friendly, red=enemy, yellow=neutral
[MODIFY] src/game/renderer.ts — drawWeatherOverlay()
Dust storm: sprite-based sand particles with directional wind
Flood: animated water rise overlay with wave crests
Tremor: screen distortion shader effect (CSS filter fallback)
[MODIFY] src/game/renderer.ts — drawPlacementGhost()
Show translucent building sprite instead of colored rectangle
Green tint for valid placement, red for invalid
Holographic scan-line effect
[NEW] src/game/renderer.ts — drawFogOfWar()
Replace simple dark overlay with layered fog system:
Fully hidden: opaque dark with noise texture
Terrain-only: desaturated terrain visible
Stale intel: hatched overlay pattern
Fresh scan: full color with scan-line sweep effect
Radar ping: expanding ring reveal animation
Implementation Order
Phase 1: Asset Pipeline
Phase 2: Terrain
Phase 3: Buildings & Units
Phase 4: HUD Overhaul
Phase 5: VFX & Polish
Recommended start: Phase 1 (required foundation) → Phase 4 (immediate visual impact with no renderer risk) → Phase 2 (terrain) → Phase 3 (sprites) → Phase 5 (polish).

Each phase is independently shippable. Phase 1 includes the fallback system so nothing breaks if sprites aren't ready.

Verification Plan
Automated Tests
pnpm --filter metal-marines typecheck — No type errors after each phase
pnpm --filter metal-marines build — Clean production build
pnpm --filter metal-marines test:game — Determinism tests still pass (renderer changes don't affect simulation)
Browser subagent: Navigate to /play/skirmish, verify canvas renders without errors
Manual Verification
Visual comparison screenshots at each phase milestone
Performance: maintain 60fps with sprite rendering (measure via browser devtools)
Responsive: canvas scales properly at different viewport sizes
Graceful fallback: game remains playable if any sprite fails to load