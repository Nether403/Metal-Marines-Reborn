import type { RuntimeState } from "@/game/types";
import { projectileCurrentPos } from "@/game/engine";
import { GRID_H, GRID_W, ISLAND_PX_W, TILE_PX } from "@/game/constants";
import { Radar, RadioTower, TriangleAlert, Wifi } from "lucide-react";
import { useEffect, useRef } from "react";

const PANEL_W = 218;
const MAP_W = 192;
const MAP_H = 90;

// Terrain color palette for mini-map
const TERRAIN_MINI: Record<string, string> = {
  WATER:       "#041020",
  MOUNTAIN:    "#1a2030",
  FOREST:      "#082618",
  GRASS:       "#0a2e1e",
  TOXIC_SLUDGE:"#2d5205",
};

export default function RadarPanel({ state }: { state: RuntimeState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hasRadar = state.buildings.some(
    (b) =>
      b.owner === "PLAYER" &&
      b.type === "RADAR" &&
      b.hp > 0 &&
      b.buildTimeRemaining <= 0 &&
      (b.disabledUntil ?? 0) <= state.elapsed
  );
  const jammerActive = state.projectiles.some((p) => p.falseSignature && p.side === "PLAYER");

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    bg.addColorStop(0, "#010a18");
    bg.addColorStop(1, "#020610");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Scan-line overlay
    ctx.fillStyle = "rgba(55,216,255,0.025)";
    for (let y = 0; y < MAP_H; y += 4) {
      ctx.fillRect(0, y, MAP_W, 1);
    }

    // Outer border
    ctx.strokeStyle = "rgba(55,216,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, MAP_W - 1, MAP_H - 1);

    // Inner secondary border
    ctx.strokeStyle = "rgba(55,216,255,0.12)";
    ctx.strokeRect(3.5, 3.5, MAP_W - 7, MAP_H - 7);

    // Tile terrain
    const tw = (MAP_W - 8) / GRID_W;
    const th = (MAP_H - 8) / GRID_H;
    const ox = 4;
    const oy = 4;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = state.playerIsland[y * GRID_W + x];
        if (!t) continue;
        ctx.fillStyle = TERRAIN_MINI[t.terrain] ?? "#0a2e1e";
        ctx.fillRect(ox + x * tw, oy + y * th, tw - 0.5, th - 0.5);
      }
    }

    // Terrain mutations (toxic/weather effects)
    for (const mutation of state.terrainMutations) {
      if (mutation.side !== "PLAYER") continue;
      ctx.fillStyle = "rgba(190,242,100,0.7)";
      ctx.fillRect(
        ox + mutation.position.x * tw + tw * 0.2,
        oy + mutation.position.y * th + th * 0.2,
        tw * 0.6, th * 0.6
      );
    }

    // Player buildings
    for (const b of state.buildings) {
      if (b.owner !== "PLAYER" || b.hp <= 0) continue;
      const px = ox + (b.pos.x + 0.5) * tw;
      const py = oy + (b.pos.y + 0.5) * th;
      const isHQ = b.type === "HQ";
      ctx.fillStyle = isHQ ? "var(--hud-player)" : "rgba(240,76,76,0.7)";
      if (isHQ) {
        // HQ gets a square marker with glow
        ctx.shadowColor = "rgba(240,76,76,0.8)";
        ctx.shadowBlur = 4;
        ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Underground mech layer
    if (state.viewLayer === "UNDERGROUND") {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const tile = state.playerIsland[y * GRID_W + x];
          if (!tile?.tunnel?.open) continue;
          ctx.fillStyle =
            (tile.tunnel.collapsedUntil ?? 0) > state.elapsed
              ? "rgba(239,68,68,0.55)"
              : "rgba(251,191,36,0.38)";
          ctx.fillRect(ox + x * tw + tw * 0.25, oy + y * th + th * 0.25, tw * 0.5, th * 0.5);
        }
      }
      for (const m of state.mechs) {
        if (m.side !== "PLAYER" || (m.layer ?? "SURFACE") !== "UNDERGROUND") continue;
        const tx = Math.floor(m.pos.x / TILE_PX);
        const tyPos = Math.floor(m.pos.y / TILE_PX);
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(ox + (tx + 0.5) * tw, oy + (tyPos + 0.5) * th, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Incoming projectile impact markers (pulsing)
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    for (const p of state.projectiles) {
      if (p.owner !== "ENEMY" || p.side !== "PLAYER" || p.intercepted) continue;
      const tx = Math.floor(p.targetWX / TILE_PX);
      const tyPos = Math.floor(p.targetWY / TILE_PX);
      if (tx < 0 || tyPos < 0 || tx >= GRID_W || tyPos >= GRID_H) continue;
      const px = ox + (tx + 0.5) * tw;
      const py = oy + (tyPos + 0.5) * th;
      const color = p.falseSignature ? "168,85,247" : "240,76,76";
      // Outer ring
      ctx.strokeStyle = `rgba(${color},${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 5 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      // Inner dot
      ctx.fillStyle = `rgba(${color},0.95)`;
      ctx.shadowColor = `rgba(${color},0.7)`;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Radar sweep overlay (when radar online)
    if (hasRadar) {
      const sweep = ((performance.now() / 1000) % 3) * ((Math.PI * 2) / 3);
      const cx = MAP_W / 2;
      const cy = MAP_H / 2;
      const grad = ctx.createConicalGradient
        ? null // Safari doesn't support conical gradient on canvas
        : null;
      void grad;
      // Approximate cone sweep with a thin wedge
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweep);
      const sweepGrad = ctx.createLinearGradient(0, 0, MAP_W / 2, 0);
      sweepGrad.addColorStop(0, "rgba(55,216,255,0.14)");
      sweepGrad.addColorStop(1, "rgba(55,216,255,0)");
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(MAP_W, MAP_H), -0.22, 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  // Threat ETAs
  const threats = state.projectiles
    .filter((p) => p.owner === "ENEMY" && p.side === "PLAYER" && !p.intercepted)
    .map((p) => {
      const cur = projectileCurrentPos(p);
      const remaining = Math.hypot(p.targetWX - cur.x, p.targetWY - cur.y);
      const eta = Math.max(0, remaining / Math.max(1, p.speed));
      return { id: p.id, type: p.type, eta };
    })
    .sort((a, b) => a.eta - b.eta)
    .slice(0, 4);

  void ISLAND_PX_W;

  const status = state.weatherActive
    ? "ECO"
    : state.viewLayer === "UNDERGROUND"
    ? "SEISMIC"
    : hasRadar
    ? jammerActive
      ? "JAMMED"
      : "ONLINE"
    : "OFFLINE";

  const statusColor =
    status === "ONLINE" ? "var(--hud-energy)" :
    status === "JAMMED" ? "var(--hud-enemy)" :
    status === "ECO" ? "#a3e635" :
    status === "SEISMIC" ? "var(--hud-funds)" :
    "rgba(100,116,139,0.6)";

  return (
    <div className="absolute right-2 top-2 z-20 select-none pointer-events-none font-mono">
      <div
        className="mm-panel"
        style={{
          width: PANEL_W,
          border: "1px solid rgba(55,216,255,0.25)",
          boxShadow: "0 0 28px rgba(55,216,255,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-1.5 text-[9px] uppercase tracking-[0.2em]"
          style={{ borderBottom: "1px solid rgba(55,216,255,0.12)" }}
        >
          <span className="flex items-center gap-1.5" style={{ color: "var(--hud-energy)" }}>
            <Radar className="h-3 w-3" />
            TACTICAL RADAR
          </span>
          <span
            className="flex items-center gap-1"
            style={{ color: statusColor, textShadow: `0 0 8px ${statusColor}` }}
          >
            {status === "ONLINE" && <Wifi className="h-2.5 w-2.5" />}
            {status}
          </span>
        </div>

        {/* Map canvas */}
        <div className="p-2">
          <div
            className="relative"
            style={{
              filter: hasRadar ? "none" : "grayscale(0.8) brightness(0.4)",
              border: "1px solid rgba(55,216,255,0.18)",
            }}
          >
            <canvas
              ref={canvasRef}
              width={MAP_W}
              height={MAP_H}
              className="block w-full"
              style={{ imageRendering: "pixelated" }}
            />
            {/* Corner markers */}
            {[["top-0 left-0","right","bottom"],["top-0 right-0","left","bottom"],["bottom-0 left-0","right","top"],["bottom-0 right-0","left","top"]].map(([pos,,,], i) => (
              <div
                key={i}
                className={`pointer-events-none absolute ${pos} h-2 w-2`}
                style={{
                  borderTop: pos.includes("top") ? "1px solid rgba(55,216,255,0.6)" : "none",
                  borderBottom: pos.includes("bottom") ? "1px solid rgba(55,216,255,0.6)" : "none",
                  borderLeft: pos.includes("left") ? "1px solid rgba(55,216,255,0.6)" : "none",
                  borderRight: pos.includes("right") ? "1px solid rgba(55,216,255,0.6)" : "none",
                }}
              />
            ))}
            {!hasRadar && (
              <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-widest"
                   style={{ color: "rgba(100,116,139,0.6)" }}>
                Build Radar Array
              </div>
            )}
          </div>

          {/* Threat list */}
          <div className="mt-1.5 min-h-[16px] text-[9px] uppercase tracking-wide">
            {hasRadar ? (
              threats.length === 0 ? (
                <span className="flex items-center gap-1" style={{ color: "rgba(55,216,255,0.6)" }}>
                  <RadioTower className="h-2.5 w-2.5" /> No inbound threats
                </span>
              ) : (
                <div className="space-y-0.5">
                  {threats.map((threat) => (
                    <div key={threat.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-1" style={{ color: "var(--hud-player)" }}>
                        <TriangleAlert className="h-2.5 w-2.5" />
                        {threat.type === "TRANSPORT_POD" ? "MECH-POD" : threat.type}
                      </span>
                      <span style={{ color: "var(--hud-funds)" }}>
                        ETA {threat.eta.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <span style={{ color: "rgba(100,116,139,0.5)" }}>Threat data offline</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
