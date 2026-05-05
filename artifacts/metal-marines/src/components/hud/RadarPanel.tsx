import type { RuntimeState } from "@/game/types";
import { projectileCurrentPos } from "@/game/engine";
import { GRID_H, GRID_W, ISLAND_PX_W, TILE_PX } from "@/game/constants";
import { Radar, RadioTower, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

const PANEL_W = 210;
const MAP_W = 186;
const MAP_H = 86;

export default function RadarPanel({ state }: { state: RuntimeState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hasRadar = state.buildings.some(
    (b) =>
      b.side === "PLAYER" &&
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
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.strokeStyle = "rgba(125,211,252,0.42)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, MAP_W - 1, MAP_H - 1);

    // Tile grid mini-map of player island
    const tw = MAP_W / GRID_W;
    const th = MAP_H / GRID_H;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const t = state.playerIsland[y * GRID_W + x];
        if (!t) continue;
        if (t.terrain === "WATER") {
          ctx.fillStyle = "#0a1933";
        } else if (t.terrain === "MOUNTAIN") {
          ctx.fillStyle = "#1f2937";
        } else if (t.terrain === "FOREST") {
          ctx.fillStyle = "#0a2d20";
        } else if (t.terrain === "TOXIC_SLUDGE") {
          ctx.fillStyle = "#4d7c0f";
        } else {
          ctx.fillStyle = "#0e3b2c";
        }
        ctx.fillRect(x * tw, y * th, tw, th);
      }
    }

    for (const mutation of state.terrainMutations) {
      if (mutation.side !== "PLAYER") continue;
      ctx.fillStyle = "rgba(190,242,100,0.75)";
      ctx.fillRect(mutation.position.x * tw + tw * 0.2, mutation.position.y * th + th * 0.2, tw * 0.6, th * 0.6);
    }

    // Player buildings as green dots
    for (const b of state.buildings) {
      if (b.side !== "PLAYER" || b.hp <= 0) continue;
      const px = (b.pos.x + 0.5) * tw;
      const py = (b.pos.y + 0.5) * th;
      ctx.fillStyle = b.type === "HQ" ? "#f87171" : "rgba(248,113,113,0.72)";
      ctx.beginPath();
      ctx.arc(px, py, b.type === "HQ" ? 3 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.viewLayer === "UNDERGROUND") {
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          const tile = state.playerIsland[y * GRID_W + x];
          if (!tile?.tunnel?.open) continue;
          ctx.fillStyle = (tile.tunnel.collapsedUntil ?? 0) > state.elapsed ? "rgba(239,68,68,0.65)" : "rgba(251,191,36,0.42)";
          ctx.fillRect(x * tw + tw * 0.25, y * th + th * 0.25, tw * 0.5, th * 0.5);
        }
      }
      for (const m of state.mechs) {
        if (m.side !== "PLAYER" || (m.layer ?? "SURFACE") !== "UNDERGROUND") continue;
        const tx = Math.floor(m.pos.x / TILE_PX);
        const ty = Math.floor(m.pos.y / TILE_PX);
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc((tx + 0.5) * tw, (ty + 0.5) * th, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Incoming hostile projectiles: pulsing red dot at projected impact tile.
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    for (const p of state.projectiles) {
      if (p.owner !== "ENEMY" || p.side !== "PLAYER" || p.intercepted) continue;
      // Projected impact tile (target in player-island coords)
      const tx = Math.floor(p.targetWX / TILE_PX);
      const ty = Math.floor(p.targetWY / TILE_PX);
      if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
      const px = (tx + 0.5) * tw;
      const py = (ty + 0.5) * th;
      ctx.strokeStyle = `rgba(239,68,68,${0.5 + 0.5 * pulse})`;
      if (p.falseSignature) ctx.strokeStyle = `rgba(168,85,247,${0.45 + 0.45 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.falseSignature ? "#a855f7" : "#ef4444";
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Count incoming threats with ETA for the side list.
  const threats = state.projectiles
    .filter(
      (p) =>
        p.owner === "ENEMY" && p.side === "PLAYER" && !p.intercepted
    )
    .map((p) => {
      const cur = projectileCurrentPos(p);
      const remaining = Math.hypot(p.targetWX - cur.x, p.targetWY - cur.y);
      const eta = Math.max(0, remaining / Math.max(1, p.speed));
      return { id: p.id, type: p.type, eta };
    })
    .sort((a, b) => a.eta - b.eta)
    .slice(0, 3);

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

  return (
    <div className="absolute top-2 right-2 z-20 font-mono pointer-events-none select-none">
      <div
        className="mm-panel mm-corner-cut border-cyan-300/35 shadow-[0_0_22px_rgba(55,216,255,0.18)]"
        style={{ width: PANEL_W }}
      >
        <div className="flex items-center justify-between border-b border-cyan-300/15 px-3 py-2 text-[10px] uppercase tracking-[0.18em]">
          <span className="mm-panel-title flex items-center gap-1.5 text-cyan-100">
            <Radar className="h-3.5 w-3.5" /> TACTICAL RADAR
          </span>
          <span
            className={
              hasRadar ? "text-cyan-100" : "text-slate-500"
            }
          >
            {status}
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div
            className="relative border border-cyan-300/25 bg-black/60 p-1 shadow-inner"
            style={{
              filter: hasRadar ? "none" : "grayscale(1) brightness(0.4)",
            }}
          >
            <canvas
              ref={canvasRef}
              width={MAP_W}
              height={MAP_H}
              className="block w-full"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="pointer-events-none absolute inset-1 border border-cyan-100/10" />
            <div className="pointer-events-none absolute left-1 top-1 h-[calc(100%-0.5rem)] w-full bg-gradient-to-b from-cyan-300/0 via-cyan-300/10 to-cyan-300/0 opacity-45" />
            {!hasRadar && (
              <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-widest text-slate-400">
                Build Radar
              </div>
            )}
          </div>
          <div className="min-h-[16px] text-[10px] uppercase tracking-wider text-red-100">
            {hasRadar ? (
              threats.length === 0 ? (
                <span className="flex items-center gap-1 text-cyan-100/75"><RadioTower className="h-3 w-3" /> No inbound</span>
              ) : (
                <span className="flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3 text-red-200" />
                  {threats.length} INBOUND ::{" "}
                  {threats
                    .map((t) => `${t.type === "TRANSPORT_POD" ? "POD" : t.type}/${t.eta.toFixed(1)}s`)
                    .join("  ")}
                </span>
              )
            ) : (
              <span className="text-slate-500">Threat data offline</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
