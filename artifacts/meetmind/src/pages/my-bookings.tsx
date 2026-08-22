import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  CalendarCheck2,
  Clock,
  Copy,
  Download,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Send,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  downloadCalendarFile,
  googleCalendarUrl,
  outlookCalendarUrl,
  readGuestBookings,
  type SavedGuestBooking,
} from "@/lib/booking-calendar";

type AccountBooking = SavedGuestBooking & {
  guestName?: string;
  guestEmail?: string;
};
type ReceivedBooking = {
  id: string;
  meetingId: number;
  guestName: string;
  guestEmail: string;
  guestTimezone: string | null;
  ownerTimezone: string;
  notes?: string | null;
  startTime: string;
  endTime: string;
  createdAt: string;
};
function displayDate(iso: string, timezone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(iso));
}
const Empty = ({ children }: { children: string }) => (
  <div className="rounded-2xl border border-dashed p-8 sm:p-10 text-center text-muted-foreground">
    {children}
  </div>
);

export default function MyBookings() {
  const { getToken } = useAuth();
  const [remote, setRemote] = useState<AccountBooking[]>([]);
  const [received, setReceived] = useState<ReceivedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const local = useMemo(() => readGuestBookings(), []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [madeResponse, receivedResponse] = await Promise.all([
          fetch("/api/guest-bookings", { headers }),
          fetch("/api/received-bookings", { headers }),
        ]);
        const [madeData, receivedData] = await Promise.all([
          madeResponse.json(),
          receivedResponse.json(),
        ]);
        if (!madeResponse.ok)
          throw new Error(madeData.error || "Could not load bookings you made");
        if (!receivedResponse.ok)
          throw new Error(
            receivedData.error || "Could not load bookings received",
          );
        if (active) {
          setRemote(madeData);
          setReceived(receivedData);
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load bookings",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getToken]);
  const made = useMemo(() => {
    const byId = new Map<string, AccountBooking>();
    [...local, ...remote].forEach((item) =>
      byId.set(item.id, { ...byId.get(item.id), ...item }),
    );
    return [...byId.values()].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [local, remote]);
  const now = Date.now();
  const receivedUpcoming = received.filter(
      (item) => new Date(item.endTime).getTime() > now,
    ),
    receivedPast = received.filter(
      (item) => new Date(item.endTime).getTime() <= now,
    ),
    madeUpcoming = made.filter(
      (item) => new Date(item.endTime).getTime() > now,
    ),
    madePast = made.filter((item) => new Date(item.endTime).getTime() <= now);
  const receivedCard = (item: ReceivedBooking) => (
    <article key={item.id} className="glass-card rounded-2xl p-5 border">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Booked with you by</p>
          <h3 className="text-xl font-bold mt-0.5">{item.guestName}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm break-all">
            <Mail className="w-4 h-4 text-primary flex-shrink-0" />
            {item.guestEmail}
          </p>
        </div>
        <a href="/app">
          <Button variant="outline" className="w-full lg:w-auto">
            <CalendarCheck2 className="w-4 h-4 mr-2" />
            View calendar
          </Button>
        </a>
      </div>
      <div className="mt-5 grid md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Your calendar time
          </p>
          <p className="font-semibold mt-1">
            {displayDate(item.startTime, item.ownerTimezone)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {item.ownerTimezone}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 border p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Booker’s detected time
          </p>
          {item.guestTimezone ? (
            <>
              <p className="font-semibold mt-1">
                {displayDate(item.startTime, item.guestTimezone)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.guestTimezone}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Timezone was not recorded.
            </p>
          )}
        </div>
      </div>
      {item.notes ? (
        <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">
          {item.notes}
        </p>
      ) : null}
    </article>
  );
  const madeCard = (item: AccountBooking) => (
    <article key={item.id} className="glass-card rounded-2xl p-5 border">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Meeting with</p>
          <h3 className="text-xl font-bold">{item.hostName}</h3>
          <p className="mt-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {displayDate(item.startTime)}
          </p>
          {item.ownerTimezone ? (
            <p className="text-sm text-muted-foreground mt-1">
              Owner time: {displayDate(item.startTime, item.ownerTimezone)} (
              {item.ownerTimezone})
            </p>
          ) : null}
        </div>
        {item.manageToken && new Date(item.startTime).getTime() > now ? (
          <a href={`/manage/${encodeURIComponent(item.manageToken)}`}>
            <Button className="w-full sm:w-auto">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reschedule
            </Button>
          </a>
        ) : null}
      </div>
      {item.manageToken ? (
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full">
              Google
            </Button>
          </a>
          <a href={outlookCalendarUrl(item)} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full">
              Outlook
            </Button>
          </a>
          <Button variant="outline" onClick={() => downloadCalendarFile(item)}>
            <Download className="w-4 h-4 mr-2" />
            Calendar file
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}/manage/${item.manageToken}`,
              )
            }
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy link
          </Button>
        </div>
      ) : null}
    </article>
  );
  return (
    <Layout>
      <div className="space-y-10 pb-16">
        <header>
          <div className="flex items-center gap-3">
            <CalendarCheck2 className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-display font-bold">Bookings</h1>
          </div>
          <p className="text-muted-foreground text-lg mt-2">
            Meetings people booked with you and meetings you booked with others.
          </p>
        </header>
        {loading ? (
          <div className="py-20 grid place-items-center">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
          </div>
        ) : error && !received.length && !made.length ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-destructive">
            {error}
          </div>
        ) : (
          <>
            {error ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                Some booking information could not be loaded: {error}
              </div>
            ) : null}
            <section className="space-y-5" aria-labelledby="received-heading">
              <div className="flex items-start gap-3">
                <Inbox className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h2 id="received-heading" className="text-2xl font-bold">
                    Bookings Received
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Meetings booked through your public scheduling link.
                  </p>
                </div>
              </div>
              <h3 className="font-bold text-lg">Upcoming</h3>
              {receivedUpcoming.length ? (
                receivedUpcoming.map(receivedCard)
              ) : (
                <Empty>No upcoming bookings have been received.</Empty>
              )}
              {receivedPast.length ? (
                <details className="rounded-2xl border p-4">
                  <summary className="font-bold cursor-pointer">
                    Past received bookings ({receivedPast.length})
                  </summary>
                  <div className="space-y-4 mt-4">
                    {receivedPast.map(receivedCard)}
                  </div>
                </details>
              ) : null}
            </section>
            <section
              className="space-y-5 border-t pt-9"
              aria-labelledby="made-heading"
            >
              <div className="flex items-start gap-3">
                <Send className="w-6 h-6 text-primary mt-1" />
                <div>
                  <h2 id="made-heading" className="text-2xl font-bold">
                    Bookings I Made
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Meetings booked through someone else’s link using an email
                    verified on this account.
                  </p>
                </div>
              </div>
              <h3 className="font-bold text-lg">Upcoming</h3>
              {madeUpcoming.length ? (
                madeUpcoming.map(madeCard)
              ) : (
                <Empty>
                  No upcoming bookings were found for your verified email.
                </Empty>
              )}
              {madePast.length ? (
                <details className="rounded-2xl border p-4">
                  <summary className="font-bold cursor-pointer">
                    Past bookings I made ({madePast.length})
                  </summary>
                  <div className="space-y-4 mt-4">{madePast.map(madeCard)}</div>
                </details>
              ) : null}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
