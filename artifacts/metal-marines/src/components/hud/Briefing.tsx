import type { MissionDef } from "@/game/types";
import { COMMANDERS } from "@/data/commanders";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, Shield, Skull } from "lucide-react";

export default function Briefing({
  mission,
  onStart,
  onAbort,
}: {
  mission: MissionDef;
  onStart: () => void;
  onAbort: () => void;
}) {
  const cmd = COMMANDERS[mission.commanderId];
  const missionNum = String(mission.index).padStart(2, "0");

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center font-mono"
      style={{
        background:
          "linear-gradient(135deg, rgba(2,6,12,0.97) 0%, rgba(4,12,24,0.97) 100%)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Scanlines overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(55,216,255,0.015) 3px, rgba(55,216,255,0.015) 4px)",
          zIndex: 1,
        }}
      />

      <div
        className="relative max-w-2xl w-full"
        style={{
          border: "1px solid rgba(55,216,255,0.3)",
          background: "linear-gradient(160deg, rgba(4,14,28,0.98) 0%, rgba(2,8,18,0.98) 100%)",
          boxShadow:
            "0 0 60px rgba(55,216,255,0.1), 0 0 120px rgba(240,76,76,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
          clipPath:
            "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
          zIndex: 2,
        }}
      >
        {/* Top header bar */}
        <div
          className="flex items-center justify-between px-5 py-2 text-[9px] uppercase tracking-[0.22em]"
          style={{
            borderBottom: "1px solid rgba(55,216,255,0.15)",
            background: "rgba(55,216,255,0.04)",
          }}
        >
          <span className="flex items-center gap-2" style={{ color: "var(--hud-energy)" }}>
            <Shield className="h-3 w-3" />
            Pacific Fleet Command
          </span>
          <span style={{ color: "rgba(55,216,255,0.5)" }}>
            MISSION {missionNum} / 06 &nbsp;·&nbsp; CLASSIFICATION: TOP SECRET
          </span>
          <span className="flex items-center gap-1" style={{ color: "var(--hud-player)" }}>
            <AlertTriangle className="h-3 w-3" />
            ACTIVE THREAT
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Mission title */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(55,216,255,0.5)" }}>
              Operation Designation
            </div>
            <h2
              className="text-2xl font-black tracking-tighter"
              style={{
                color: "var(--hud-energy)",
                textShadow: "0 0 18px rgba(55,216,255,0.45), 0 0 40px rgba(55,216,255,0.15)",
              }}
            >
              {mission.title}
            </h2>
          </div>

          {/* Commander dossier */}
          <div
            className="flex gap-4"
            style={{
              border: "1px solid rgba(240,76,76,0.2)",
              background: "rgba(240,76,76,0.04)",
              padding: "12px",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
            }}
          >
            <div
              className="relative flex-shrink-0"
              style={{ border: "1px solid rgba(240,76,76,0.4)" }}
            >
              <img
                src={cmd.imageUrl}
                alt={cmd.name}
                className="w-28 h-28 object-cover"
                style={{ filter: "sepia(0.2) contrast(1.1)" }}
              />
              {/* Red corner accent on image */}
              <div
                className="absolute top-0 right-0 w-3 h-3"
                style={{ borderTop: "2px solid var(--hud-player)", borderRight: "2px solid var(--hud-player)" }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="text-[8px] uppercase tracking-[0.18em] mb-0.5" style={{ color: "var(--hud-player)" }}>
                  <Skull className="inline h-2.5 w-2.5 mr-1" />Enemy Commander
                </div>
                <div
                  className="text-base font-bold tracking-wide"
                  style={{ color: "rgba(248,113,113,0.95)" }}
                >
                  {cmd.name}
                </div>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(200,220,240,0.7)" }}>
                {cmd.bio}
              </p>
            </div>
          </div>

          {/* Intel / briefing text */}
          <div className="text-[11px] leading-relaxed" style={{ color: "rgba(180,210,240,0.75)" }}>
            {mission.briefing}
          </div>

          {/* Objective box */}
          <div
            style={{
              border: "1px solid rgba(55,216,255,0.25)",
              background: "rgba(55,216,255,0.04)",
              padding: "10px 14px",
              clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
            }}
          >
            <div
              className="text-[9px] uppercase tracking-[0.18em] mb-1 flex items-center gap-1"
              style={{ color: "var(--hud-energy)" }}
            >
              <ChevronRight className="h-3 w-3" /> Primary Objective
            </div>
            <div className="text-[12px] font-semibold" style={{ color: "rgba(220,240,255,0.9)" }}>
              {mission.objective}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <Button
              variant="outline"
              className="font-mono text-[10px] uppercase tracking-widest h-9 px-5"
              style={{
                borderColor: "rgba(100,116,139,0.4)",
                color: "rgba(148,163,184,0.8)",
                background: "transparent",
              }}
              onClick={onAbort}
            >
              Stand Down
            </Button>
            <Button
              className="font-mono text-[10px] uppercase tracking-widest h-9 px-7"
              style={{
                background: "linear-gradient(135deg, rgba(220,38,38,0.85) 0%, rgba(185,28,28,0.85) 100%)",
                border: "1px solid rgba(240,76,76,0.55)",
                color: "#fff",
                boxShadow: "0 0 18px rgba(240,76,76,0.35)",
                clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
              }}
              onClick={onStart}
            >
              Engage — {String.fromCharCode(9657)} Deploy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
