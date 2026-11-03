import type { Meeting } from "@workspace/api-client-react";
import { ExternalLink, MapPin, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { countdownParts } from "@/lib/countdown";
import { APP_TZ, formatTimeEST, timezoneAbbreviation } from "@/lib/timezone";

const pad = (value: number) => String(value).padStart(2, "0");

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-2 py-4 text-center backdrop-blur sm:px-4">
      <strong className="block text-3xl font-black tabular-nums sm:text-5xl">
        {pad(value)}
      </strong>
      <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export function CountdownClock({ meeting }: { meeting: Meeting }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const parts = countdownParts(meeting.startTime, now);
  if (!parts) return null;

  const hasStarted = new Date(meeting.startTime).getTime() <= now;
  return (
    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-600 p-5 text-white shadow-2xl shadow-indigo-900/20 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-200">
            {hasStarted ? "Meeting time" : "Next meeting"}
          </p>
          <h2 className="mt-2 break-words text-2xl font-black sm:text-4xl">
            {meeting.title}
          </h2>
          <p className="mt-2 text-indigo-100">
            {formatTimeEST(meeting.startTime, "EEEE, MMMM d 'at' h:mm a")}{" "}
            {timezoneAbbreviation(APP_TZ, meeting.startTime)}
          </p>
        </div>
        {meeting.meetingUrl ? (
          <a href={meeting.meetingUrl} target="_blank" rel="noreferrer">
            <Button className="w-full rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 sm:w-auto">
              <Video className="mr-2 h-4 w-4" /> Join meeting
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </a>
        ) : null}
      </div>

      <div
        className="mt-7 grid grid-cols-4 gap-2 sm:gap-4"
        aria-live="off"
        aria-label={
          hasStarted ? "Meeting has started" : "Time remaining until meeting"
        }
      >
        <TimeUnit value={parts.days} label="Days" />
        <TimeUnit value={parts.hours} label="Hours" />
        <TimeUnit value={parts.minutes} label="Minutes" />
        <TimeUnit value={parts.seconds} label="Seconds" />
      </div>

      {meeting.location ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-indigo-100">
          <MapPin className="h-4 w-4 shrink-0" /> {meeting.location}
        </p>
      ) : null}
    </section>
  );
}
