# Metal Marines 2026 — Style Bible (Sprint 0)

**Goal:** Beat the 1993 Win3.1 original on **clarity**. Deliberate remaster, not AAA trailer bait.

## Camera & grid
- Top-down grid, `TILE_PX = 64` (unchanged)
- Buildings drawn as **fake-isometric** sprites on rectangular cells
- Anchor: buildings `anchorY ≈ 0.75`, mechs `≈ 0.85` (feet on tile)

## Palette
| Role | Hex-ish | Notes |
|------|---------|-------|
| Grass | deep/mid/hi greens | Classic MM island — brighter than pre-remaster sludge |
| Water | deep teal → cyan foam | High contrast vs land |
| Player structures | olive drab + **red** trim/flags + white accents | Military MM, not neon sci-fi |
| Enemy structures | purple mass + **gold** trim | Readable faction at combat zoom |
| Metal | cool gray hierarchy | Edges catch light |

## Silhouette rules
1. Every building must read as a **unique roof/mass shape** at 64px
2. Mechs: torso + legs + gun — no mud, no black-on-black
3. No photographic texture noise; soft dither OK
4. Transparent backgrounds only
5. Construction = cyan wire scaffold (not muddy half-meshes)
6. Damaged = scorch + fire wink; Disabled = EMP cyan wash

## North star references
- OG Win3.1 screenshots in `Game-art/Metal-marines-original/`
- Identity: player disciplined reds, enemy gold/purple
- **Not** the README marketing hero (aspirational mockup)

## Definition of done (portfolio gate)
A real in-game capture where:
- Islands read green and dense
- Bases look built (pads + chunky structures)
- Mechs readable while walking
- Side-by-side with OG does not embarrass the remaster

Generated assets: `public/game-assets/{terrain,buildings-*,units,fx,projectiles}.png`
