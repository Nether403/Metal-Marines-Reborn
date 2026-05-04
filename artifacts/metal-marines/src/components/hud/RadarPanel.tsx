import type { RuntimeState } from "@/game/types";
import { projectileCurrentPos } from "@/game/engine";
import { GRID_H, GRID_W, ISLAND_PX_W, TILE_PX } from "@/game/constants";
import { Radar } from "lucide-react";
import { useEffect, useRef } from "react";

const PANEL_W = 168;
const PANEL_H = 110;
const MAP_W = 152;
const MAP_H = 70;

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
    ctx.strokeStyle = "rgba(34,197,94,0.45)";
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
        } else {
          ctx.fillStyle = "#0e3b2c";
        }
        ctx.fillRect(x * tw, y * th, tw, th);
      }
    }

    // Player buildings as green dots
    for (const b of state.buildings) {
      if (b.side !== "PLAYER" || b.hp <= 0) continue;
      const px = (b.pos.x + 0.5) * tw;
      const py = (b.pos.y + 0.5) * th;
      ctx.fillStyle = b.type === "HQ" ? "#22c55e" : "rgba(34,197,94,0.7)";
      ctx.beginPath();
      ctx.arc(px, py, b.type === "HQ" ? 3 : 1.6, 0, Math.PI * 2);
      ctx.fill();
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

  return (
    <div className="absolute top-2 right-2 z-20 font-mono pointer-events-none select-none">
      <div
        className="bg-background/85 border border-primary/50 rounded shadow-[0_0_12px_rgba(34,197,94,0.25)]"
        style={{ width: PANEL_W }}
      >
        <div className="flex items-center justify-between px-2 py-1 border-b border-primary/30 text-[10px] uppercase tracking-widest text-primary">
          <span className="flex items-center gap-1">
            <Radar className="w-3 h-3" /> RADAR
          </span>
          <span
            className={
              hasRadar ? "text-primary" : "text-muted-foreground/70"
            }
          >
            {hasRadar ? (jammerActive ? "JAMMED" : "ONLINE") : "OFFLINE"}
          </span>
        </div>
        <div className="p-2 flex flex-col gap-1.5">
          <div
            className="relative"
            style={{
              width: MAP_W,
              height: MAP_H,
              filter: hasRadar ? "none" : "grayscale(1) brightness(0.4)",
            }}
          >
            <canvas
              ref={canvasRef}
              width={MAP_W}
              height={MAP_H}
              className="block w-full h-full"
              style={{ imageRendering: "pixelated" }}
            />
            {!hasRadar && (
              <div className="absolute inset-0 flex items-center justify-center text-[9px] text-muted-foreground uppercase">
                Build Radar
              </div>
            )}
          </div>
          <div className="text-[10px] text-destructive uppercase tracking-wider min-h-[14px]">
            {hasRadar ? (
              threats.length === 0 ? (
                <span className="text-primary/70">No inbound</span>
              ) : (
                <span>
                  {threats.length} INBOUND ::{" "}
                  {threats
                    .map((t) => `${t.type === "TRANSPORT_POD" ? "POD" : t.type}/${t.eta.toFixed(1)}s`)
                    .join("  ")}
                </span>
              )
            ) : (
              <span className="text-muted-foreground/70">Threat data offline</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
