import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  useGetMeetings,
  type Meeting,
} from "@workspace/api-client-react";
import {
  BellRing,
  ExternalLink,
  Loader2,
  MonitorUp,
  MoonStar,
  Shield,
  Smartphone,
  TimerReset,
} from "lucide-react";
import { CountdownClock } from "@/components/countdown-clock";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { meetingIsStillRelevant } from "@/lib/countdown";
import { formatTimeEST } from "@/lib/timezone";

type CountdownSettings = {
  enabled: boolean;
  startMinutes: number;
  privacyMode: "title" | "private";
};

type WakeLockLike = {
  release: () => Promise<void>;
  addEventListener: (name: string, listener: () => void) => void;
};

const defaultSettings: CountdownSettings = {
  enabled: false,
  startMinutes: 120,
  privacyMode: "title",
};

export default function CountdownPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: meetings, isLoading } = useGetMeetings({
    query: {
      queryKey: ["/api/meetings"],
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });
  const settingsQuery = useQuery({
    queryKey: ["countdown-settings"],
    queryFn: () =>
      customFetch<CountdownSettings>("/api/countdown-settings", {
        responseType: "json",
      }),
  });
  const saveSettings = useMutation({
    scope: { id: "countdown-settings-save" },
    mutationFn: (settings: CountdownSettings) =>
      customFetch<CountdownSettings>("/api/countdown-settings", {
        method: "PUT",
        responseType: "json",
        body: JSON.stringify(settings),
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(["countdown-settings"], settings);
      toast({
        title: settings.enabled
          ? "Attention mode enabled"
          : "Attention mode disabled",
      });
    },
    onError: (error: Error) =>
      toast({
        variant: "destructive",
        title: "Could not save countdown settings",
        description: error.message,
      }),
  });
  const upcoming = useMemo(
    () =>
      (meetings || [])
        .filter((meeting) => meetingIsStillRelevant(meeting))
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
    [meetings],
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected =
    upcoming.find((meeting) => meeting.id === selectedId) || upcoming[0];
  const [wakeActive, setWakeActive] = useState(false);
  const wakeLock = useRef<WakeLockLike | null>(null);
  const compact =
    new URLSearchParams(window.location.search).get("compact") === "1";

  useEffect(
    () => () => {
      void wakeLock.current?.release();
    },
    [],
  );

  async function toggleWakeLock() {
    if (wakeLock.current) {
      await wakeLock.current.release();
      wakeLock.current = null;
      setWakeActive(false);
      return;
    }
    const wakeLockApi = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
      }
    ).wakeLock;
    if (!wakeLockApi) {
      toast({
        title: "Keep-screen-awake is not supported on this device",
        description:
          "The countdown still works while MeetMind remains visible.",
      });
      return;
    }
    try {
      const lock = await wakeLockApi.request("screen");
      wakeLock.current = lock;
      setWakeActive(true);
      lock.addEventListener("release", () => {
        wakeLock.current = null;
        setWakeActive(false);
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not keep the screen awake",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  if (compact) {
    return (
      <main className="min-h-screen bg-slate-950 p-3 text-white">
        {selected ? (
          <CountdownClock meeting={selected} />
        ) : (
          <div className="grid min-h-[60vh] place-items-center text-slate-300">
            No upcoming meetings
          </div>
        )}
      </main>
    );
  }

  const settings = settingsQuery.data || defaultSettings;
  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <div>
          <div className="flex items-center gap-3">
            <TimerReset className="h-9 w-9 text-primary" />
            <h1 className="text-4xl font-display font-bold">
              Meeting Countdown
            </h1>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            Keep the next meeting visible and add stronger reminders before it
            begins.
          </p>
        </div>

        {isLoading ? (
          <div className="h-80 animate-pulse rounded-[2rem] bg-muted" />
        ) : selected ? (
          <CountdownClock meeting={selected} />
        ) : (
          <div className="rounded-3xl border border-dashed p-14 text-center text-muted-foreground">
            No upcoming meetings. New meetings will appear here automatically.
          </div>
        )}

        {upcoming.length > 1 ? (
          <section>
            <h2 className="mb-3 text-xl font-bold">Coming next</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.slice(0, 6).map((meeting: Meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  onClick={() => setSelectedId(meeting.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected?.id === meeting.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <strong className="block truncate">{meeting.title}</strong>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {formatTimeEST(meeting.startTime, "EEE, MMM d · h:mm a")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border bg-card p-6">
            <div className="flex items-start gap-3">
              <BellRing className="mt-1 h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-bold">Attention mode</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adds server-scheduled alerts at the selected start point, 60
                  minutes, 30 minutes, 10 minutes, and the meeting start. Your
                  existing reminders remain unchanged.
                </p>
              </div>
            </div>
            {settingsQuery.isLoading ? (
              <Loader2 className="mt-6 animate-spin" />
            ) : (
              <div className="mt-6 space-y-4">
                <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
                  <span className="font-medium">
                    Use stronger countdown alerts
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(event) =>
                      saveSettings.mutate({
                        ...settings,
                        enabled: event.target.checked,
                      })
                    }
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold">
                    Begin extra alerts
                  </span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={settings.startMinutes}
                    onChange={(event) =>
                      saveSettings.mutate({
                        ...settings,
                        startMinutes: Number(event.target.value),
                      })
                    }
                  >
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                    <option value={240}>4 hours before</option>
                    <option value={480}>8 hours before</option>
                    <option value={1440}>1 day before</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold">
                    Lock-screen privacy
                  </span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={settings.privacyMode}
                    onChange={(event) =>
                      saveSettings.mutate({
                        ...settings,
                        privacyMode: event.target
                          .value as CountdownSettings["privacyMode"],
                      })
                    }
                  >
                    <option value="title">Show meeting title</option>
                    <option value="private">
                      Show “Open MeetMind for details”
                    </option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="rounded-3xl border bg-card p-6">
            <h2 className="text-xl font-bold">Display controls</h2>
            <div className="mt-5 grid gap-3">
              <Button
                variant="outline"
                className="justify-start"
                onClick={toggleWakeLock}
              >
                <MoonStar className="mr-2 h-4 w-4" />
                {wakeActive
                  ? "Allow screen to sleep"
                  : "Keep this screen awake"}
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() =>
                  window.open(
                    "/app/countdown?compact=1",
                    "meetmind-countdown",
                    "popup=yes,width=560,height=520",
                  )
                }
              >
                <MonitorUp className="mr-2 h-4 w-4" /> Open compact desktop
                window <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Mobile PWA:</strong>{" "}
                  displays the live countdown and can keep the screen awake
                  while visible. When the phone is locked, server push alerts
                  continue.
                </span>
              </p>
              <p className="flex gap-2">
                <MonitorUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">Desktop:</strong> use the
                  compact window beside your other work. A future signed desktop
                  companion can add always-on-top behavior.
                </span>
              </p>
              <p className="flex gap-2">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  A true iPhone Live Activity or Android lock-screen timer
                  requires the separately signed native mobile companion; the
                  PWA cannot obtain that permission.
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
