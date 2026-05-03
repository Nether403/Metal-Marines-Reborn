import { Link } from "wouter";
import { MISSIONS } from "@/data/missions";
import { COMMANDERS } from "@/data/commanders";
import { useGame, isMissionUnlocked } from "@/game/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2 } from "lucide-react";

export default function MissionSelect() {
  const progress = useGame((s) => s.progress);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-primary font-mono drop-shadow-[0_0_8px_rgba(0,255,128,0.5)]">
              MISSION SELECT
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Six sectors. Six commanders. End the war.
            </p>
          </div>
          <Link href="/">
            <Button
              variant="outline"
              className="font-mono border-primary/30 text-primary hover:bg-primary/10"
            >
              RETURN
            </Button>
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
