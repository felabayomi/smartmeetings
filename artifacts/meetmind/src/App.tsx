import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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

// Secret URL token baked in at build time.
// The app is only visible at /<SECRET> — all other paths render blank.
const SECRET = import.meta.env.VITE_CALENDAR_SECRET as string | undefined;

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
  // If visiting the secret URL, use it as the router base so /list etc. work.
  // If visiting any other path (including /), show the app normally at root.
  const path = window.location.pathname;
  const secretBase = SECRET ? `/${SECRET}` : null;
  const base = secretBase && path.startsWith(secretBase)
    ? secretBase
    : import.meta.env.BASE_URL.replace(/\/$/, "");

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
