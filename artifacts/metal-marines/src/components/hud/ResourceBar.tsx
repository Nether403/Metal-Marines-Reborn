import { Zap, Coins, Clock, Heart, ShieldAlert, RadioTower, Activity } from "lucide-react";
import type { RuntimeState } from "@/game/types";
import type { ReactNode } from "react";

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
  const activeThreats = state.projectiles.filter(
    (p) => p.owner === "ENEMY" && p.side === "PLAYER" && !p.intercepted
  ).length;
  const weatherRemaining = state.weatherActive
    ? Math.max(0, state.weatherActive.duration - (state.elapsed - state.weatherActive.startedAt))
    : 0;

  return (
    <div className="mm-panel border-x-0 border-t-0 px-3 py-2 font-mono text-sm">
      <div className="flex items-center gap-3">
        <div className="mm-corner-cut min-w-[210px] border border-red-400/35 bg-red-950/25 px-3 py-2 shadow-[0_0_18px_rgba(240,76,76,0.18)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="mm-panel-title text-[10px] text-red-200/80">HOME COMMAND</div>
              <div className="text-lg font-black tracking-tight text-red-100">METAL MARINES</div>
            </div>
            <div className="grid h-10 w-10 place-items-center border border-red-300/40 bg-red-500/15 text-red-100">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
        </div>

        <ResourceStat
          icon={<Coins className="h-4 w-4" />}
          label="WAR FUNDS"
          value={fmt(state.playerFunds)}
          rate={`+${state.playerFundsRate.toFixed(0)}/s`}
          pct={Math.min(1, state.playerFunds / 1200)}
          color="var(--hud-funds)"
        />
        <ResourceStat
          icon={<Zap className="h-4 w-4" />}
          label="ENERGY"
          value={fmt(state.playerEnergy)}
          rate={`+${state.playerEnergyRate.toFixed(0)}/s`}
          pct={Math.min(1, state.playerEnergy / 900)}
          color="var(--hud-energy)"
        />

        <div className="mm-corner-cut min-w-[190px] border border-slate-500/30 bg-slate-950/55 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-300/80">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> HQ INTEGRITY</span>
            <span>{Math.round(hpPct * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden border border-slate-400/25 bg-black/60">
            <div
              className={`mm-stat-fill h-full transition-all ${
                hpPct > 0.5 ? "bg-red-400" : hpPct > 0.25 ? "bg-amber-400" : "bg-destructive"
              }`}
              style={{ width: `${hpPct * 100}%` }}
            />
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <StatusPill icon={<Clock className="h-3.5 w-3.5" />} label="T+" value={time(state.elapsed)} tone="slate" />
          <StatusPill icon={<RadioTower className="h-3.5 w-3.5" />} label="THREATS" value={activeThreats.toString()} tone={activeThreats ? "red" : "cyan"} />
          {disabledCount > 0 && <StatusPill label="EMP LOCK" value={disabledCount.toString()} tone="cyan" />}
          {state.viewLayer === "UNDERGROUND" && (
            <StatusPill label="TUNNELS" value={undergroundContacts ? `${undergroundContacts} CONTACT` : "VIEW"} tone="amber" />
          )}
          {state.weatherActive && (
            <StatusPill
              icon={<Activity className="h-3.5 w-3.5" />}
              label={state.weatherActive.type.replace("_", " ")}
              value={`${weatherRemaining.toFixed(0)}s`}
              tone="lime"
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-4 border-t border-white/5 pt-1 text-[10px] uppercase tracking-widest text-slate-400">
        <span>FIRED <span className="text-slate-100">{state.stats.missilesFired}</span></span>
        <span>DROPS <span className="text-slate-100">{state.stats.marinesDeployed}</span></span>
        <span>KILLS <span className="text-red-200">{state.stats.buildingsDestroyed}</span></span>
        <span>LOST <span className="text-destructive">{state.stats.buildingsLost}</span></span>
        <span>ECO <span className="text-lime-300">{state.stats.environmentalActions}</span></span>
      </div>
    </div>
  );
}

function ResourceStat({
  icon,
  label,
  value,
  rate,
  pct,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  rate: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="mm-corner-cut min-w-[170px] border border-slate-500/30 bg-slate-950/55 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-300/80">
        <span className="flex items-center gap-1" style={{ color }}>{icon}{label}</span>
        <span style={{ color }}>{rate}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
        <div className="mb-1 h-2 w-20 overflow-hidden border border-slate-400/25 bg-black/60">
          <div className="mm-stat-fill h-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  value,
  tone,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  tone: "slate" | "red" | "cyan" | "amber" | "lime";
}) {
  const toneClass = {
    slate: "border-slate-400/25 bg-slate-900/50 text-slate-200",
    red: "border-red-400/40 bg-red-500/15 text-red-100",
    cyan: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
    amber: "border-amber-300/35 bg-amber-500/10 text-amber-100",
    lime: "border-lime-300/35 bg-lime-500/10 text-lime-100",
  }[tone];
  return (
    <div className={`mm-corner-cut flex items-center gap-1.5 border px-2 py-1 text-[10px] uppercase tracking-wider ${toneClass}`}>
      {icon}
      <span className="text-current/60">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
