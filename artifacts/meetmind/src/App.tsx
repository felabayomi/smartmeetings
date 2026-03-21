import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setGlobalHeader } from "@workspace/api-client-react";
import { getCalendarToken, getRouterBase, persistToken } from "@/lib/calendar-token";

// Pages
import Dashboard from "./pages/dashboard";
import MeetingsList from "./pages/meetings-list";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// Resolve the calendar token once (may trigger a redirect for root visitors)
const CALENDAR_TOKEN = getCalendarToken();
// Persist so future visits to / return to the same calendar
persistToken(CALENDAR_TOKEN);
// Inject into every API request globally
setGlobalHeader("x-calendar-token", CALENDAR_TOKEN);

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/list" component={MeetingsList} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = getRouterBase(CALENDAR_TOKEN);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ServiceWorkerRegistrar />
        <WouterRouter base={base}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
