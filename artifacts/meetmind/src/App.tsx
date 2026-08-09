import { useEffect, useState, type ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { SignIn, SignUp, useAuth } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenProvider } from "@workspace/api-client-react";

// Pages
import Dashboard from "./pages/dashboard";
import MeetingsList from "./pages/meetings-list";
import NotFound from "./pages/not-found";
import Landing from "./pages/landing";
import AuthPage from "./pages/auth";
import Scheduling from "./pages/scheduling";
import PublicBooking from "./pages/public-booking";
import PublicPoll from "./pages/public-poll";
import { DataPrivacy, HowToUse, TermsOfUse } from "./pages/information";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const showWaitingWorker = (worker: ServiceWorker | null) => {
      if (worker && navigator.serviceWorker.controller) setWaitingWorker(worker);
    };
    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const checkForUpdate = () => { if (document.visibilityState === "visible") void registration?.update(); };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      registration = reg;
      showWaitingWorker(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") showWaitingWorker(reg.waiting || installing);
        });
      });
      void reg.update();
    }).catch((err) => console.warn("SW registration failed:", err));

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  if (!waitingWorker) return null;
  const restartForUpdate = () => {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
    window.setTimeout(() => window.location.reload(), 1500);
  };
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-slate-950 px-4 py-3 text-white shadow-2xl sm:bottom-5">
      <div><p className="font-semibold">Update available</p><p className="text-sm text-slate-300">Restart MeetMind to use the latest version.</p></div>
      <button type="button" onClick={restartForUpdate} className="flex-shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">Restart</button>
    </div>
  );
}

function ProtectedApp() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading MeetMind…</div>;
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <Switch>
      <Route path="/app" component={Dashboard} />
      <Route path="/app/list" component={MeetingsList} />
      <Route path="/app/scheduling" component={Scheduling} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedRequests({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthTokenProvider(() => getToken());
    setReady(true);
    return () => {
      setAuthTokenProvider(null);
      setReady(false);
    };
  }, [getToken]);

  return ready ? children : null;
}

function Router() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in/:rest*">
        {isLoaded && isSignedIn ? <Redirect to="/app" /> : <AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></AuthPage>}
      </Route>
      <Route path="/sign-in">
        {isLoaded && isSignedIn ? <Redirect to="/app" /> : <AuthPage><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></AuthPage>}
      </Route>
      <Route path="/sign-up/:rest*">
        {isLoaded && isSignedIn ? <Redirect to="/app" /> : <AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>}
      </Route>
      <Route path="/sign-up">
        {isLoaded && isSignedIn ? <Redirect to="/app" /> : <AuthPage><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthPage>}
      </Route>
      <Route path="/book/:slug" component={PublicBooking} />
      <Route path="/poll/:slug" component={PublicPoll} />
      <Route path="/terms" component={TermsOfUse} />
      <Route path="/privacy" component={DataPrivacy} />
      <Route path="/how-to-use" component={HowToUse} />
      <Route path="/app/:rest*" component={ProtectedApp} />
      <Route path="/app" component={ProtectedApp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ServiceWorkerRegistrar />
        <AuthenticatedRequests>
          <Router />
        </AuthenticatedRequests>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
