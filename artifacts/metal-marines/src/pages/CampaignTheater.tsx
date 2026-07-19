import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MISSIONS, getMission } from "@/data/missions";
import { COMMANDERS } from "@/data/commanders";
import { THEATER_LINKS, THEATER_NODES } from "@/data/theater";
import { useGame, isMissionUnlocked } from "@/game/store";
import {
  SKIRMISH_DIFFICULTIES,
  formatSkirmishMissionId,
  randomSkirmishSeed,
  type SkirmishDifficulty,
} from "@/game/procedural";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, Play, Radar, List } from "lucide-react";

type NodeState = "secured" | "available" | "classified";

function nodeState(missionIndex: number, cleared: string[], missionId: string): NodeState {
  if (cleared.includes(missionId)) return "secured";
  if (isMissionUnlocked(missionIndex, cleared)) return "available";
  return "classified";
}

export default function CampaignTheater() {
  const progress = useGame((s) => s.progress);
  const hasSnapshot = useGame((s) => s.hasSnapshot);
  const loadSnapshot = useGame((s) => s.loadSnapshot);
  const clearSnapshot = useGame((s) => s.clearSnapshot);
  const [, setLocation] = useLocation();
  const snap = hasSnapshot();
  const snapMission = snap ? getMission(snap.missionId) : null;

  const firstAvailable =
    MISSIONS.find(
      (m) => nodeState(m.index, progress.cleared, m.id) === "available"
    )?.id ?? "m1";
  const [selectedId, setSelectedId] = useState(firstAvailable);
  const [skirmishDiff, setSkirmishDiff] = useState<SkirmishDifficulty>(3);
  const [skirmishSeed, setSkirmishSeed] = useState("");
  const selected = getMission(selectedId);
  const selectedCmd = selected ? COMMANDERS[selected.commanderId] : null;
  const selectedState = selected
    ? nodeState(selected.index, progress.cleared, selected.id)
    : "classified";

  const posById = useMemo(() => {
    const map = new Map(THEATER_NODES.map((n) => [n.id, n]));
    return map;
  }, []);

  const securedCount = progress.cleared.filter((id) => id.startsWith("m")).length;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#050a14] text-foreground">
      {/* Full-bleed theater */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105 theater-drift"
        style={{ backgroundImage: "url(/campaign/theater.jpg)" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050a14]/75 via-[#050a14]/35 to-[#050a14]/90" />
      <div className="absolute inset-0 theater-radar pointer-events-none opacity-40" aria-hidden />

      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <header className="flex items-start justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-red-400/90">
              Metal Marines
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.85)]">
              THEATER COMMAND
            </h1>
            <p className="max-w-xl font-mono text-sm text-cyan-100/80">
              Twenty Pacific sectors. Secure the chain. End the war.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href="/">
              <Button
                variant="outline"
                className="font-mono border-white/20 bg-black/40 text-white hover:bg-white/10"
              >
                RETURN
              </Button>
            </Link>
            <Link href="/missions">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-cyan-200/80 hover:text-cyan-100"
              >
                <List className="mr-1 h-3.5 w-3.5" /> LIST VIEW
              </Button>
            </Link>
          </div>
        </header>

        {snap && snapMission && (
          <div className="mx-5 md:mx-8 mt-4 flex flex-wrap items-center justify-between gap-3 border border-cyan-400/40 bg-cyan-950/50 px-4 py-3 backdrop-blur-sm">
            <div className="font-mono text-sm text-cyan-100">
              <span className="text-[10px] uppercase tracking-widest text-cyan-300/70">
                Saved Operation
              </span>
              <div className="font-bold">
                {snapMission.title} — {Math.floor(snap.elapsed / 60)}m{" "}
                {Math.floor(snap.elapsed % 60)}s
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="font-mono border-red-400/40 text-red-300"
                onClick={() => clearSnapshot()}
              >
                DISCARD
              </Button>
              <Button
                size="sm"
                className="font-mono bg-cyan-500 text-black hover:bg-cyan-400"
                onClick={() => {
                  const id = loadSnapshot();
                  if (id) setLocation(`/play/${id}?engage=1`);
                }}
              >
                <Play className="mr-1 h-3.5 w-3.5" /> RESUME
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col lg:flex-row gap-4 px-5 py-4 md:px-8 md:pb-8">
          {/* Map stage */}
          <div className="relative flex-1 min-h-[52vh] lg:min-h-0 overflow-hidden border border-white/10 bg-black/30 shadow-[0_0_60px_rgba(0,40,80,0.45)]">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{ backgroundImage: "url(/campaign/theater.jpg)" }}
            />
            <div className="absolute inset-0 bg-[#061018]/25" />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {THEATER_LINKS.map(([a, b]) => {
                const pa = posById.get(a);
                const pb = posById.get(b);
                if (!pa || !pb) return null;
                const aState = nodeState(
                  MISSIONS.find((m) => m.id === a)?.index ?? 99,
                  progress.cleared,
                  a
                );
                const lit = aState !== "classified" || progress.cleared.includes(b);
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={lit ? "rgba(34,211,238,0.45)" : "rgba(148,163,184,0.15)"}
                    strokeWidth={0.35}
                    strokeDasharray={lit ? "1.2 1" : "0.6 1.4"}
                  />
                );
              })}
            </svg>

            {THEATER_NODES.map((node) => {
              const mission = MISSIONS.find((m) => m.id === node.id);
              if (!mission) return null;
              const state = nodeState(mission.index, progress.cleared, mission.id);
              const active = selectedId === mission.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(mission.id)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group ${
                    state === "available" ? "theater-pulse" : ""
                  }`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  aria-label={mission.title}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold shadow-lg transition-transform group-hover:scale-110 ${
                      state === "secured"
                        ? "border-emerald-300 bg-emerald-950/90 text-emerald-200"
                        : state === "available"
                          ? "border-red-400 bg-red-950/90 text-white"
                          : "border-slate-500 bg-slate-950/80 text-slate-400"
                    } ${active ? "ring-2 ring-cyan-300 scale-110" : ""}`}
                  >
                    {state === "secured" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : state === "classified" ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      mission.index
                    )}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white md:group-hover:block">
                    {mission.title.replace("Operation: ", "")}
                  </span>
                </button>
              );
            })}

            <div className="absolute bottom-3 left-3 flex gap-3 font-mono text-[10px] uppercase tracking-wider text-white/70">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Secured
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-500" /> Classified
              </span>
            </div>
            <div className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-wider text-cyan-200/80">
              {securedCount}/20 sectors secured
            </div>
          </div>

          {/* Intel panel */}
          <aside className="w-full lg:w-[340px] shrink-0 border border-white/10 bg-black/55 p-5 backdrop-blur-md flex flex-col gap-4">
            <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs uppercase tracking-[0.25em]">
              <Radar className="h-4 w-4" /> Sector Intel
            </div>

            {selected && selectedCmd ? (
              <>
                <div>
                  <div className="font-mono text-[11px] text-red-300/90 uppercase tracking-widest">
                    Sector {String(selected.index).padStart(2, "0")} · {selectedState}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-white leading-tight">
                    {selected.title}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-cyan-200/80">
                    VS {selectedCmd.name}
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="h-20 w-20 overflow-hidden border border-white/15 bg-muted/40 shrink-0">
                    <img
                      src={selectedCmd.imageUrl}
                      alt={selectedCmd.name}
                      className={`h-full w-full object-cover ${
                        selectedState === "classified" ? "grayscale opacity-50" : ""
                      }`}
                    />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed line-clamp-5">
                    {selectedState === "classified"
                      ? "Sector classified. Clear the previous operation to unlock briefing."
                      : selected.briefing}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-3 font-mono text-xs uppercase tracking-wider text-amber-200/90">
                  Objective:{" "}
                  {selectedState === "classified" ? "—" : selected.objective}
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  {selectedState === "classified" ? (
                    <Button
                      disabled
                      className="w-full font-mono bg-muted/40 text-muted-foreground"
                    >
                      CLASSIFIED
                    </Button>
                  ) : (
                    <Link href={`/play/${selected.id}`}>
                      <Button className="w-full font-mono bg-red-600 hover:bg-red-500 text-white border border-red-300/30 shadow-[0_0_20px_rgba(220,38,38,0.35)]">
                        {selectedState === "secured" ? "REPLAY SECTOR" : "LAUNCH OPERATION"}
                      </Button>
                    </Link>
                  )}
                  <div className="space-y-2 rounded border border-cyan-400/25 bg-cyan-950/20 p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-200/70">
                        Diff
                      </span>
                      {SKIRMISH_DIFFICULTIES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSkirmishDiff(d)}
                          className={`min-w-7 px-1.5 py-0.5 font-mono text-xs border transition-colors ${
                            skirmishDiff === d
                              ? "border-cyan-300 bg-cyan-500/25 text-cyan-100"
                              : "border-white/15 text-slate-400 hover:border-cyan-400/40"
                          }`}
                          title={`AI aggression tier ${d}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <input
                      value={skirmishSeed}
                      onChange={(e) => setSkirmishSeed(e.target.value)}
                      placeholder="Seed (optional)"
                      maxLength={24}
                      className="w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-cyan-50 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <Button
                      variant="outline"
                      className="w-full font-mono border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10"
                      onClick={() => {
                        const seed = skirmishSeed.trim()
                          ? skirmishSeed
                          : randomSkirmishSeed();
                        setLocation(`/play/${formatSkirmishMissionId(seed, skirmishDiff)}`);
                      }}
                    >
                      GENERATE SKIRMISH
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a sector on the theater map.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
