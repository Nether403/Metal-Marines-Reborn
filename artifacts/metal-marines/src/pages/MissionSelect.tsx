import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MISSIONS, getMission } from "@/data/missions";
import { COMMANDERS } from "@/data/commanders";
import { useGame, isMissionUnlocked } from "@/game/store";
import {
  SKIRMISH_DIFFICULTIES,
  formatSkirmishMissionId,
  randomSkirmishSeed,
  type SkirmishDifficulty,
} from "@/game/procedural";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, Play } from "lucide-react";

export default function MissionSelect() {
  const progress = useGame((s) => s.progress);
  const loadSnapshot = useGame((s) => s.loadSnapshot);
  const hasSnapshot = useGame((s) => s.hasSnapshot);
  const clearSnapshot = useGame((s) => s.clearSnapshot);
  const [, setLocation] = useLocation();
  const snap = hasSnapshot();
  const snapMission = snap ? getMission(snap.missionId) : null;
  const [skirmishDiff, setSkirmishDiff] = useState<SkirmishDifficulty>(3);
  const [skirmishSeed, setSkirmishSeed] = useState("");

  const launchSkirmish = () => {
    const seed = skirmishSeed.trim() ? skirmishSeed : randomSkirmishSeed();
    setLocation(`/play/${formatSkirmishMissionId(seed, skirmishDiff)}`);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary font-mono drop-shadow-[0_0_8px_rgba(0,255,128,0.5)]">
              MISSION LIST
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Twenty operations. Prefer Theater Command for the campaign map.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/campaign">
              <Button
                variant="outline"
                className="font-mono border-secondary/40 text-secondary hover:bg-secondary/10"
              >
                THEATER
              </Button>
            </Link>
            <Link href="/">
              <Button
                variant="outline"
                className="font-mono border-primary/30 text-primary hover:bg-primary/10"
              >
                RETURN
              </Button>
            </Link>
          </div>
        </header>

        {snap && snapMission && (
          <div className="flex items-center justify-between gap-4 p-3 border border-secondary/50 bg-secondary/10 rounded font-mono">
            <div className="text-sm text-secondary">
              <span className="uppercase tracking-wider text-xs opacity-70">
                Saved Operation
              </span>
              <div className="text-base font-bold">
                {snapMission.title} — {Math.floor(snap.elapsed / 60)}m{" "}
                {Math.floor(snap.elapsed % 60)}s elapsed
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="font-mono border-destructive/40 text-destructive"
                onClick={() => {
                  clearSnapshot();
                  setLocation("/missions");
                }}
              >
                DISCARD
              </Button>
              <Button
                size="sm"
                className="font-mono bg-secondary text-secondary-foreground"
                onClick={() => {
                  const id = loadSnapshot();
                  if (id) setLocation(`/play/${id}?engage=1`);
                }}
              >
                <Play className="w-3.5 h-3.5 mr-1" /> RESUME
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-card/60 transition-colors group relative overflow-hidden border-secondary/40 hover:border-secondary/80">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-80 pointer-events-none" />
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold text-foreground">
                    Generated Skirmish
                  </CardTitle>
                  <CardDescription className="font-mono text-secondary uppercase text-xs">
                    Procedural island war
                  </CardDescription>
                </div>
                <span className="font-mono text-2xl font-black text-muted-foreground/30">∞</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Deterministic island generator with validation for coastline, buildable area, chokepoints, and navigable mech routes.
              </p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-secondary/80">
                    Difficulty
                  </span>
                  {SKIRMISH_DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSkirmishDiff(d)}
                      className={`min-w-7 px-1.5 py-0.5 font-mono text-xs border transition-colors ${
                        skirmishDiff === d
                          ? "border-secondary bg-secondary/25 text-secondary"
                          : "border-border/60 text-muted-foreground hover:border-secondary/50"
                      }`}
                      title={`AI aggression tier ${d}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-secondary/80">
                    Seed (optional)
                  </span>
                  <input
                    value={skirmishSeed}
                    onChange={(e) => setSkirmishSeed(e.target.value)}
                    placeholder="leave blank for random"
                    maxLength={24}
                    className="w-full rounded border border-border/60 bg-background/80 px-2 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-secondary/60 focus:outline-none"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-mono text-secondary mb-3 uppercase tracking-wider">
                  OBJECTIVE: Destroy the generated enemy HQ
                </p>
                <Button
                  className="w-full font-mono bg-secondary/20 hover:bg-secondary hover:text-secondary-foreground text-secondary border border-secondary/50 transition-all"
                  onClick={launchSkirmish}
                >
                  GENERATE SECTOR
                </Button>
              </div>
            </CardContent>
          </Card>
          {MISSIONS.map((mission) => {
            const cmd = COMMANDERS[mission.commanderId];
            const unlocked = isMissionUnlocked(mission.index, progress.cleared);
            const cleared = progress.cleared.includes(mission.id);
            return (
              <Card
                key={mission.id}
                className={`bg-card/60 transition-colors group relative overflow-hidden ${
                  unlocked
                    ? "border-primary/30 hover:border-primary/70"
                    : "border-border/50 opacity-60 grayscale"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        {cleared && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        {mission.title}
                      </CardTitle>
                      <CardDescription className="font-mono text-primary/80 uppercase text-xs">
                        VS {cmd.name}
                      </CardDescription>
                    </div>
                    <span className="font-mono text-2xl font-black text-muted-foreground/30">
                      0{mission.index}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded bg-muted/50 border border-primary/20 overflow-hidden shrink-0 relative">
                      <img
                        src={cmd.imageUrl}
                        alt={cmd.name}
                        className="w-full h-full object-cover"
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Lock className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                      {unlocked ? cmd.bio : "Sector classified. Clear the previous operation to unlock briefing."}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-mono text-secondary mb-3 uppercase tracking-wider">
                      OBJECTIVE: {unlocked ? mission.objective : "—"}
                    </p>
                    {unlocked ? (
                      <Link href={`/play/${mission.id}`}>
                        <Button className="w-full font-mono bg-primary/20 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/50 transition-all">
                          {cleared ? "REPLAY" : "INITIALIZE"}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        disabled
                        className="w-full font-mono bg-muted/30 text-muted-foreground border border-border"
                      >
                        LOCKED
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
