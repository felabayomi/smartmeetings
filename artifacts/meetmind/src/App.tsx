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
import RescheduleBooking from "./pages/reschedule-booking";
import MyBookings from "./pages/my-bookings";
import PublicPoll from "./pages/public-poll";
import { DataPrivacy, HowToUse, TermsOfUse } from "./pages/information";
import { useToast } from "@/hooks/use-toast";
import {
  APP_TZ,
  detectedDeviceTimezone,
  timezoneAbbreviation,
} from "@/lib/timezone";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    const checkForUpdate = () => { if (document.visibilityState === "visible") void registration?.update(); };

    document.addEventListener("visibilitychange", checkForUpdate);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      registration = reg;
      void reg.update();
    }).catch((err) => console.warn("SW registration failed:", err));

    return () => {
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);
  return null;
}

const TIMEZONE_CHANGE_NOTICE = "meetmind-timezone-change";

function AutomaticTimezoneMonitor() {
  const { toast } = useToast();

  useEffect(() => {
    const savedNotice = sessionStorage.getItem(TIMEZONE_CHANGE_NOTICE);
    if (savedNotice) {
      sessionStorage.removeItem(TIMEZONE_CHANGE_NOTICE);
      try {
        const { from, to } = JSON.parse(savedNotice) as {
          from: string;
          to: string;
        };
        toast({
          title: "Timezone updated automatically",
          description: `Calendar times changed from ${from} to ${to}. Meeting instants and reminders were not changed.`,
          duration: 10000,
        });
      } catch {
        // Ignore an invalid or obsolete notice.
      }
    }

    let reloading = false;
    const checkTimezone = () => {
      if (reloading || document.visibilityState === "hidden") return;
      const detectedTimezone = detectedDeviceTimezone();
      if (detectedTimezone === APP_TZ) return;

      reloading = true;
      sessionStorage.setItem(
        TIMEZONE_CHANGE_NOTICE,
        JSON.stringify({
          from: `${APP_TZ} (${timezoneAbbreviation(APP_TZ)})`,
          to: `${detectedTimezone} (${timezoneAbbreviation(detectedTimezone)})`,
        }),
      );
      window.location.reload();
    };

    const checkAfterResume = () => {
      if (document.visibilityState === "visible") checkTimezone();
    };

    document.addEventListener("visibilitychange", checkAfterResume);
    window.addEventListener("focus", checkTimezone);
    const intervalId = window.setInterval(checkTimezone, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", checkAfterResume);
      window.removeEventListener("focus", checkTimezone);
      window.clearInterval(intervalId);
    };
  }, [toast]);

  return null;
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
      <Route path="/app/my-bookings" component={MyBookings} />
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
      <Route path="/manage/:token" component={RescheduleBooking} />
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
        <AutomaticTimezoneMonitor />
        <AuthenticatedRequests>
          <Router />
        </AuthenticatedRequests>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
