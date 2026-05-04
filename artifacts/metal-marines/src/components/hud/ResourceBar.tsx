import { Zap, Coins, Clock, Heart } from "lucide-react";
import type { RuntimeState } from "@/game/types";

const fmt = (n: number) => Math.floor(n).toLocaleString();
const time = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

export default function ResourceBar({ state }: { state: RuntimeState }) {
  const hq = state.buildings.find((b) => b.side === "PLAYER" && b.type === "HQ");
  const hpPct = hq ? Math.max(0, hq.hp / hq.maxHp) : 0;
  const disabledCount = state.buildings.filter(
    (b) => b.side === "PLAYER" && b.hp > 0 && (b.disabledUntil ?? 0) > state.elapsed
  ).length;
  const undergroundContacts = state.mechs.filter(
    (m) => m.side === "PLAYER" && (m.layer ?? "SURFACE") === "UNDERGROUND"
  ).length;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-black/60 border-b border-primary/30 font-mono text-sm">
      <div className="flex items-center gap-2 text-yellow-300">
        <Coins className="w-4 h-4" />
        <span className="font-bold tabular-nums">{fmt(state.playerFunds)}</span>
        <span className="text-xs text-yellow-300/60">+{state.playerFundsRate.toFixed(0)}/s</span>
      </div>
      <div className="flex items-center gap-2 text-cyan-300">
        <Zap className="w-4 h-4" />
        <span className="font-bold tabular-nums">{fmt(state.playerEnergy)}</span>
        <span className="text-xs text-cyan-300/60">+{state.playerEnergyRate.toFixed(0)}/s</span>
      </div>
      <div className="flex items-center gap-2 text-primary">
        <Heart className="w-4 h-4" />
        <div className="w-32 h-2 bg-black/60 border border-primary/30 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all ${
              hpPct > 0.5 ? "bg-primary" : hpPct > 0.25 ? "bg-yellow-400" : "bg-destructive"
            }`}
            style={{ width: `${hpPct * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">HQ</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span className="tabular-nums">{time(state.elapsed)}</span>
      </div>
      {disabledCount > 0 && (
        <div className="text-cyan-200 bg-cyan-500/10 border border-cyan-400/30 px-2 py-0.5 rounded uppercase text-xs">
          EMP LOCK {disabledCount}
        </div>
      )}
      {state.viewLayer === "UNDERGROUND" && (
        <div className="text-amber-200 bg-amber-500/10 border border-amber-400/30 px-2 py-0.5 rounded uppercase text-xs">
          TUNNEL VIEW {undergroundContacts ? `· ${undergroundContacts} CONTACT` : ""}
        </div>
      )}
      {state.weatherActive && (
        <div className="text-lime-200 bg-lime-500/10 border border-lime-400/30 px-2 py-0.5 rounded uppercase text-xs">
          {state.weatherActive.type.replace("_", " ")} {(state.weatherActive.duration - (state.elapsed - state.weatherActive.startedAt)).toFixed(0)}s
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>FIRED <span className="text-foreground">{state.stats.missilesFired}</span></span>
        <span>DROPS <span className="text-foreground">{state.stats.marinesDeployed}</span></span>
        <span>KILLS <span className="text-primary">{state.stats.buildingsDestroyed}</span></span>
        <span>LOST <span className="text-destructive">{state.stats.buildingsLost}</span></span>
        <span>ECO <span className="text-lime-300">{state.stats.environmentalActions}</span></span>
      </div>
    </div>
  );
}
