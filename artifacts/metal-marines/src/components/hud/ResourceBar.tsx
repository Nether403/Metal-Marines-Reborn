import { Zap, Coins, Clock, Heart, ShieldAlert, RadioTower, Activity, Wifi, Target } from "lucide-react";
import type { RuntimeState } from "@/game/types";
import type { ReactNode } from "react";

const fmt = (n: number) => Math.floor(n).toLocaleString();
const timeFmt = (s: number) => {
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
  const activeThreats = state.projectiles.filter(
    (p) => p.owner === "ENEMY" && p.side === "PLAYER" && !p.intercepted
  ).length;
  const weatherRemaining = state.weatherActive
    ? Math.max(0, state.weatherActive.duration - (state.elapsed - state.weatherActive.startedAt))
    : 0;

  const hpColor =
    hpPct > 0.6 ? "var(--hud-player)" : hpPct > 0.3 ? "var(--hud-funds)" : "#ff2222";

  return (
    <div
      className="mm-panel border-x-0 border-t-0 font-mono"
      style={{ background: "linear-gradient(180deg,rgba(5,9,19,0.97),rgba(11,20,32,0.96))" }}
    >
      {/* Top separator line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(240,76,76,0.5) 30%,rgba(55,216,255,0.3) 70%,transparent)" }} />

      <div className="flex items-stretch gap-0">

        {/* ── FACTION BADGE ── */}
        <div
          className="relative flex flex-col items-center justify-center gap-1 border-r px-4 py-2"
          style={{
            borderColor: "rgba(240,76,76,0.3)",
            background: "linear-gradient(135deg,rgba(240,76,76,0.12),rgba(5,9,19,0.8))",
            minWidth: 140,
          }}
        >
          {/* Animated threat glow when threats present */}
          {activeThreats > 0 && (
            <div
              className="absolute inset-0 rounded-none"
              style={{
                background: "rgba(240,76,76,0.07)",
                animation: "mm-threat-pulse 0.9s ease-in-out infinite",
              }}
            />
          )}
          <div className="relative flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center"
              style={{
                border: "1px solid rgba(240,76,76,0.6)",
                background: "rgba(240,76,76,0.15)",
                clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
              }}
            >
              <ShieldAlert className="h-4 w-4" style={{ color: "var(--hud-player)" }} />
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.22em]" style={{ color: "rgba(240,76,76,0.7)" }}>HOME CMD</div>
              <div className="text-[11px] font-black tracking-[0.12em]" style={{ color: "var(--hud-player)" }}>METAL MARINES</div>
            </div>
          </div>
          {/* Mission timer */}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" style={{ color: "rgba(148,163,184,0.6)" }} />
            <span className="text-xs tabular-nums font-bold" style={{ color: "rgba(226,232,240,0.85)" }}>
              T+ {timeFmt(state.elapsed)}
            </span>
          </div>
        </div>

        {/* ── RESOURCES ── */}
        <div className="flex flex-1 items-center gap-2 px-3 py-2">
          <ResourceStat
            icon={<Coins className="h-3.5 w-3.5" />}
            label="WAR FUNDS"
            value={fmt(state.playerFunds)}
            rate={`+${state.playerFundsRate.toFixed(0)}/s`}
            pct={Math.min(1, state.playerFunds / 1200)}
            color="var(--hud-funds)"
          />
          <ResourceStat
            icon={<Zap className="h-3.5 w-3.5" />}
            label="ENERGY"
            value={fmt(state.playerEnergy)}
            rate={`+${state.playerEnergyRate.toFixed(0)}/s`}
            pct={Math.min(1, state.playerEnergy / 900)}
            color="var(--hud-energy)"
          />

          {/* HQ Integrity arc */}
          <div
            className="flex flex-col justify-center px-3 py-1.5"
            style={{
              borderLeft: "1px solid var(--hud-line)",
              minWidth: 160,
            }}
          >
            <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.18em]">
              <span className="flex items-center gap-1" style={{ color: "rgba(226,232,240,0.6)" }}>
                <Heart className="h-2.5 w-2.5" /> HQ INTEGRITY
              </span>
              <span className="font-bold tabular-nums" style={{ color: hpColor }}>
                {Math.round(hpPct * 100)}%
              </span>
            </div>
            {/* Segmented HP bar */}
            <div className="flex gap-px">
              {Array.from({ length: 20 }).map((_, i) => {
                const filled = (i + 1) / 20 <= hpPct;
                const near = (i + 1) / 20 <= hpPct + 0.05;
                return (
                  <div
                    key={i}
                    className="h-2.5 flex-1 transition-all duration-150"
                    style={{
                      background: filled
                        ? hpColor
                        : near
                        ? `${hpColor}44`
                        : "rgba(15,23,42,0.8)",
                      boxShadow: filled ? `0 0 4px ${hpColor}80` : "none",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── STATUS PILLS ── */}
        <div
          className="flex flex-col justify-center gap-1.5 border-l px-3 py-2"
          style={{ borderColor: "var(--hud-line)", minWidth: 180 }}
        >
          <div className="flex flex-wrap gap-1">
            <StatusPill
              icon={<RadioTower className="h-3 w-3" />}
              label="THREATS"
              value={activeThreats.toString()}
              tone={activeThreats > 0 ? "red" : "slate"}
              pulse={activeThreats > 0}
            />
            <StatusPill
              icon={<Target className="h-3 w-3" />}
              label="KILLS"
              value={state.stats.buildingsDestroyed.toString()}
              tone="slate"
            />
            {disabledCount > 0 && (
              <StatusPill
                icon={<Wifi className="h-3 w-3" />}
                label="EMP"
                value={`${disabledCount} LOCK`}
                tone="cyan"
                pulse
              />
            )}
            {state.weatherActive && (
              <StatusPill
                icon={<Activity className="h-3 w-3" />}
                label={state.weatherActive.type.replace("_", " ")}
                value={`${weatherRemaining.toFixed(0)}s`}
                tone="lime"
              />
            )}
          </div>

          {/* Mini stats row */}
          <div className="flex items-center gap-3 text-[8px] uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.55)" }}>
            <span>FIRED <span className="font-bold" style={{ color: "rgba(226,232,240,0.8)" }}>{state.stats.missilesFired}</span></span>
            <span>DROPS <span className="font-bold" style={{ color: "rgba(226,232,240,0.8)" }}>{state.stats.marinesDeployed}</span></span>
            <span>LOST <span className="font-bold" style={{ color: "var(--hud-player)" }}>{state.stats.buildingsLost}</span></span>
            <span>ECO <span className="font-bold" style={{ color: "#a3e635" }}>{state.stats.environmentalActions}</span></span>
          </div>
        </div>
      </div>

      {/* Bottom separator */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,rgba(55,216,255,0.18) 50%,transparent)" }} />
    </div>
  );
}

function ResourceStat({
  icon, label, value, rate, pct, color,
}: {
  icon: ReactNode; label: string; value: string; rate: string; pct: number; color: string;
}) {
  return (
    <div
      className="flex flex-col justify-center px-2.5 py-1.5"
      style={{
        minWidth: 150,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(5,9,19,0.65)",
        clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
      }}
    >
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.18em]">
        <span className="flex items-center gap-1" style={{ color }}>
          {icon}
          {label}
        </span>
        <span className="tabular-nums opacity-70" style={{ color }}>{rate}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>
          {value}
        </span>
        {/* Segmented bar */}
        <div className="mb-0.5 flex h-1.5 flex-1 gap-px overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 transition-all duration-100"
              style={{
                background: (i + 1) / 16 <= pct ? color : "rgba(15,23,42,0.7)",
                boxShadow: (i + 1) / 16 <= pct ? `0 0 3px ${color}60` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  icon, label, value, tone, pulse = false,
}: {
  icon?: ReactNode; label: string; value: string;
  tone: "slate" | "red" | "cyan" | "amber" | "lime";
  pulse?: boolean;
}) {
  const colors: Record<typeof tone, { border: string; bg: string; text: string; glow: string }> = {
    slate: { border: "rgba(100,116,139,0.35)", bg: "rgba(15,23,42,0.7)", text: "rgba(226,232,240,0.85)", glow: "transparent" },
    red:   { border: "rgba(240,76,76,0.5)",   bg: "rgba(240,76,76,0.12)", text: "var(--hud-player)", glow: "rgba(240,76,76,0.3)" },
    cyan:  { border: "rgba(55,216,255,0.45)",  bg: "rgba(55,216,255,0.1)", text: "var(--hud-energy)", glow: "rgba(55,216,255,0.25)" },
    amber: { border: "rgba(246,196,83,0.45)",  bg: "rgba(246,196,83,0.1)", text: "var(--hud-funds)", glow: "rgba(246,196,83,0.2)" },
    lime:  { border: "rgba(163,230,53,0.4)",   bg: "rgba(163,230,53,0.1)", text: "#a3e635", glow: "rgba(163,230,53,0.2)" },
  };
  const c = colors[tone];
  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] uppercase tracking-wider"
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
        boxShadow: pulse ? `0 0 8px ${c.glow}` : "none",
        animation: pulse ? "mm-threat-pulse 0.9s ease-in-out infinite" : "none",
      }}
    >
      {icon}
      <span style={{ opacity: 0.65 }}>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
