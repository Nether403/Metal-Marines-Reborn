import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import { getMission } from "@/data/missions";

export default function Home() {
  const [, setLocation] = useLocation();
  const loadSnapshot = useGame((s) => s.loadSnapshot);
  const hasSnapshot = useGame((s) => s.hasSnapshot);
  const snap = hasSnapshot();
  const snapMission = snap ? getMission(snap.missionId) : null;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden bg-background">
      {/* Animated Radar Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full border border-primary/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full border border-primary/40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] rounded-full border border-primary/50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20vw] h-[20vw] max-w-[200px] max-h-[200px] rounded-full border border-primary/60" />
        <div className="absolute top-1/2 left-1/2 w-[40vw] max-w-[400px] h-[2px] bg-gradient-to-r from-primary to-transparent origin-left animate-[spin_4s_linear_infinite]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-8">
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary drop-shadow-[0_0_15px_rgba(0,255,128,0.5)]">
            METAL MARINES
          </h1>
          <p className="text-xl md:text-2xl font-mono text-primary/80 uppercase tracking-widest">
            Tactical Operations Command :: 2026
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
          {snap && snapMission && (
            <Button
              size="lg"
              className="w-full text-lg h-14 font-mono bg-secondary hover:bg-secondary/90 text-secondary-foreground border border-secondary/60 shadow-[0_0_15px_rgba(56,189,248,0.35)]"
              onClick={() => {
                const id = loadSnapshot();
                if (id) setLocation(`/play/${id}?engage=1`);
              }}
            >
              RESUME :: {snapMission.title.replace("Operation: ", "")}
            </Button>
          )}
          <Link href="/campaign">
            <Button size="lg" className="w-full text-lg h-14 font-mono bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/50 shadow-[0_0_15px_rgba(0,255,128,0.3)]">
              NEW CAMPAIGN
            </Button>
          </Link>
          <Link href="/missions">
            <Button variant="outline" size="lg" className="w-full text-lg h-14 font-mono border-secondary/50 text-secondary hover:bg-secondary/10">
              MISSION LIST
            </Button>
          </Link>
          <Link href="/how-to-play">
            <Button variant="outline" size="lg" className="w-full text-lg h-14 font-mono border-primary/50 text-primary hover:bg-primary/10">
              HOW TO PLAY
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
