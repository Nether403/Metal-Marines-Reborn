import { useEffect, useRef, useState, useCallback } from "react";
// no per-frame react state needed
import { useRoute, useLocation } from "wouter";
import { useGame } from "@/game/store";
import { renderFrame } from "@/game/renderer";
import {
  ISLAND_PX_W,
  WORLD_H,
  WORLD_W,
  TILE_PX,
  GRID_W,
  GRID_H,
  BUILDINGS,
  WEAPON_LABELS,
} from "@/game/constants";
import { worldToTile, inIsland } from "@/game/engine";
import type { Owner } from "@/game/types";
import ResourceBar from "@/components/hud/ResourceBar";
import BuildPalette from "@/components/hud/BuildPalette";
import AlertStack from "@/components/hud/AlertStack";
import EndScreen from "@/components/hud/EndScreen";
import Briefing from "@/components/hud/Briefing";
import { Button } from "@/components/ui/button";
import { Pause, Play as PlayIcon, X } from "lucide-react";

const HOTKEYS_BUILD: Record<string, string> = {
  "1": "ENERGY_PLANT",
  "2": "SUPPLY_DEPOT",
  "3": "RADAR",
  "4": "MISSILE_LAUNCHER",
  "5": "METAL_MARINE_BASE",
  "6": "AA_GUN",
  "7": "GUN_TURRET",
  "8": "LAND_MINE",
};
const HOTKEYS_WEAPON: Record<string, string> = {
  q: "ICBM",
  w: "DUMMY",
  e: "AA",
  r: "TRANSPORT_POD",
};

export default function Play() {
  const [, params] = useRoute("/play/:missionId");
  const [, setLocation] = useLocation();
  const missionId = params?.missionId;

  const runtime = useGame((s) => s.runtime);
  const mission = useGame((s) => s.mission);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const startMission = useGame((s) => s.startMission);
  const endMission = useGame((s) => s.endMission);
  const step = useGame((s) => s.step);
  const tryBuild = useGame((s) => s.tryBuild);
  const tryFire = useGame((s) => s.tryFire);
  const selectBuild = useGame((s) => s.selectBuild);
  const selectWeapon = useGame((s) => s.selectWeapon);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const hoverRef = useRef<{ side: Owner; x: number; y: number } | null>(null);
  const [showBriefing, setShowBriefing] = useState(() => {
    if (typeof window === "undefined") return true;
    return !new URLSearchParams(window.location.search).has("engage");
  });
  // Initialize mission on mount or when missionId changes. Avoid depending on `runtime`
  // (which churns every store push) to prevent re-running this effect mid-game.
  useEffect(() => {
    if (!missionId) return;
    const cur = useGame.getState().runtime;
    if (!cur || cur.missionId !== missionId) {
      startMission(missionId);
      setShowBriefing(
        typeof window !== "undefined"
          ? !new URLSearchParams(window.location.search).has("engage")
          : true
      );
    }
  }, [missionId, startMission]);

  // Game loop
  useEffect(() => {
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      if (!showBriefing) step(dt);
      const c = canvasRef.current;
      const rt = useGame.getState().runtime;
      if (c && rt) {
        const ctx = c.getContext("2d");
        if (ctx) renderFrame(ctx, rt, hoverRef.current, now / 1000);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step, showBriefing]);

  // Resize canvas to fit
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = WORLD_W;
    c.height = WORLD_H;
  }, []);

  const handleCanvasClick = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      const rt = useGame.getState().runtime;
      if (!c || !rt) return;
      const rect = c.getBoundingClientRect();
      const scaleX = WORLD_W / rect.width;
      const scaleY = WORLD_H / rect.height;
      const wx = (ev.clientX - rect.left) * scaleX;
      const wy = (ev.clientY - rect.top) * scaleY;
      if (inIsland("PLAYER", wx, wy)) {
        if (rt.selectedBuild) {
          const t = worldToTile("PLAYER", wx, wy);
          tryBuild(t.x, t.y);
        }
      } else if (inIsland("ENEMY", wx, wy)) {
        if (rt.selectedWeapon) {
          tryFire(wx, wy);
        }
      }
    },
    [tryBuild, tryFire]
  );

  const handleCanvasMove = useCallback((ev: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const scaleX = WORLD_W / rect.width;
    const scaleY = WORLD_H / rect.height;
    const wx = (ev.clientX - rect.left) * scaleX;
    const wy = (ev.clientY - rect.top) * scaleY;
    if (inIsland("PLAYER", wx, wy)) {
      const t = worldToTile("PLAYER", wx, wy);
      hoverRef.current = { side: "PLAYER", x: t.x, y: t.y };
    } else if (inIsland("ENEMY", wx, wy)) {
      const t = worldToTile("ENEMY", wx, wy);
      hoverRef.current = { side: "ENEMY", x: t.x, y: t.y };
    } else {
      hoverRef.current = null;
    }
  }, []);

  const handleCanvasContext = useCallback(
    (ev: React.MouseEvent<HTMLCanvasElement>) => {
      ev.preventDefault();
      selectBuild(null);
      selectWeapon(null);
    },
    [selectBuild, selectWeapon]
  );

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        selectBuild(null);
        selectWeapon(null);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        setPaused(!useGame.getState().paused);
        return;
      }
      const k = e.key.toLowerCase();
      if (HOTKEYS_BUILD[e.key]) {
        selectBuild(HOTKEYS_BUILD[e.key] as keyof typeof BUILDINGS);
      } else if (HOTKEYS_WEAPON[k]) {
        selectWeapon(HOTKEYS_WEAPON[k] as keyof typeof WEAPON_LABELS);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectBuild, selectWeapon, setPaused]);

  if (!missionId) {
    setLocation("/missions");
    return null;
  }

  if (!runtime || !mission) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-primary">
        LOADING SECTOR...
      </div>
    );
  }

  const cursorStyle =
    runtime.selectedBuild || runtime.selectedWeapon ? "crosshair" : "default";

  // Avoid unused warnings
  void GRID_W;
  void GRID_H;
  void TILE_PX;
  void ISLAND_PX_W;

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <ResourceBar state={runtime} />

      {/* Canvas region */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        <div
          className="relative"
          style={{
            width: "min(100%, calc((100vh - 280px) * " + (WORLD_W / WORLD_H) + "))",
            aspectRatio: `${WORLD_W} / ${WORLD_H}`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ cursor: cursorStyle, imageRendering: "pixelated" }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
            onContextMenu={handleCanvasContext}
          />
          <AlertStack state={runtime} />
          {paused && runtime.status === "PLAYING" && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center z-30">
              <div className="text-center font-mono">
                <div className="text-5xl font-black text-primary mb-3 tracking-tighter">
                  PAUSED
                </div>
                <Button
                  className="font-mono bg-primary text-primary-foreground"
                  onClick={() => setPaused(false)}
                >
                  <PlayIcon className="w-4 h-4 mr-2" /> RESUME
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Pause / Quit corner */}
        <div className="absolute top-2 left-2 flex gap-2 z-20">
          <Button
            variant="outline"
            size="sm"
            className="font-mono border-primary/30 h-8"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <PlayIcon className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono border-destructive/40 text-destructive h-8"
            onClick={() => {
              endMission();
              setLocation("/missions");
            }}
          >
            <X className="w-3.5 h-3.5 mr-1" /> ABORT
          </Button>
        </div>

        {/* Selected indicator */}
        <div className="absolute top-2 right-2 z-20 font-mono text-xs">
          {runtime.selectedBuild && (
            <div className="px-2 py-1 bg-primary/20 border border-primary/60 text-primary">
              BUILDING :: {BUILDINGS[runtime.selectedBuild].name}
            </div>
          )}
          {runtime.selectedWeapon && (
            <div className="px-2 py-1 bg-destructive/20 border border-destructive/60 text-destructive">
              TARGETING :: {WEAPON_LABELS[runtime.selectedWeapon].name}
            </div>
          )}
        </div>
      </div>

      <BuildPalette state={runtime} />

      {showBriefing && runtime.status === "PLAYING" && (
        <Briefing
          mission={mission}
          onStart={() => {
            setShowBriefing(false);
            setPaused(false);
          }}
          onAbort={() => {
            endMission();
            setLocation("/missions");
          }}
        />
      )}

      {(runtime.status === "VICTORY" || runtime.status === "DEFEAT") && (
        <EndScreen state={runtime} mission={mission} />
      )}
    </div>
  );
}
