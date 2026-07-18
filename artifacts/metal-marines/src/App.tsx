import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MissionSelect from "@/pages/MissionSelect";
import CampaignTheater from "@/pages/CampaignTheater";
import Play from "@/pages/Play";
import HowToPlay from "@/pages/HowToPlay";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/campaign" component={CampaignTheater} />
      <Route path="/missions" component={MissionSelect} />
      <Route path="/play/:missionId" component={Play} />
      <Route path="/how-to-play" component={HowToPlay} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-[100dvh] bg-background text-foreground scanlines">
            <Router />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
