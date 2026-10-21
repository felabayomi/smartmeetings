import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  CalendarCog,
  Check,
  Clipboard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type SubscriptionStatus = {
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  feedUrl?: string;
};

export default function CalendarSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [feedUrl, setFeedUrl] = useState("");

  const statusQuery = useQuery({
    queryKey: ["calendar-subscription"],
    queryFn: () =>
      customFetch<SubscriptionStatus>("/api/calendar-subscription", {
        responseType: "json",
      }),
  });

  const generateSubscription = useMutation({
    mutationFn: () =>
      customFetch<SubscriptionStatus>("/api/calendar-subscription", {
        method: "POST",
        responseType: "json",
      }),
    onSuccess: (result) => {
      setFeedUrl(result.feedUrl || "");
      queryClient.setQueryData(["calendar-subscription"], {
        active: true,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
      toast({
        title: "Private subscription link created",
        description: "Copy it now and add it to Apple Calendar.",
      });
    },
    onError: (error: Error) =>
      toast({
        variant: "destructive",
        title: "Could not create subscription",
        description: error.message,
      }),
  });

  const revokeSubscription = useMutation({
    mutationFn: () =>
      customFetch<SubscriptionStatus>("/api/calendar-subscription", {
        method: "DELETE",
        responseType: "json",
      }),
    onSuccess: () => {
      setFeedUrl("");
      queryClient.setQueryData(["calendar-subscription"], { active: false });
      toast({
        title: "Calendar subscription revoked",
        description: "The previous private link no longer works.",
      });
    },
    onError: (error: Error) =>
      toast({
        variant: "destructive",
        title: "Could not revoke subscription",
        description: error.message,
      }),
  });

  const status = statusQuery.data;
  const busy = generateSubscription.isPending || revokeSubscription.isPending;

  const generate = () => {
    if (
      status?.active &&
      !window.confirm(
        "Replace the private subscription link? Apple Calendar subscriptions using the current link will stop updating.",
      )
    ) {
      return;
    }
    generateSubscription.mutate();
  };

  const revoke = () => {
    if (
      window.confirm(
        "Revoke this subscription link? Apple Calendar will no longer be able to refresh it.",
      )
    ) {
      revokeSubscription.mutate();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast({ title: "Subscription link copied" });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy automatically",
        description: "Select and copy the subscription link manually.",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <header>
          <div className="flex items-center gap-3">
            <CalendarCog className="h-8 w-8 text-primary" />
            <h1 className="font-display text-4xl font-bold">Calendar Settings</h1>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            Subscribe to your MeetMinder calendar from Apple Calendar.
          </p>
        </header>

        <section className="glass-card space-y-6 rounded-3xl p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">Private calendar subscription</h2>
              </div>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                This read-only feed includes your current meetings, recurring occurrences,
                timezone-correct appointment times, updates, and cancellations.
              </p>
            </div>
            {status?.active ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                <Check className="h-4 w-4" /> Active
              </span>
            ) : null}
          </div>

          {statusQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading subscription status…
            </div>
          ) : statusQuery.isError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Calendar subscription settings could not be loaded. Please refresh and try again.
            </div>
          ) : (
            <>
              {feedUrl ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
                  <p className="font-bold text-amber-950">Copy this private link now</p>
                  <p className="mt-1 text-sm text-amber-900">
                    For security, MeetMinder stores only a one-way hash and cannot show this
                    exact link again. Anyone with the link can read your calendar.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label="Private Apple Calendar subscription link"
                      autoComplete="off"
                      readOnly
                      type="password"
                      value={feedUrl}
                      className="bg-white font-mono"
                    />
                    <Button type="button" onClick={copyLink} className="sm:flex-shrink-0">
                      <Clipboard className="mr-2 h-4 w-4" /> Copy Subscription Link
                    </Button>
                  </div>
                </div>
              ) : status?.active ? (
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="font-semibold">Your private feed is active.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The secret link is not recoverable after leaving this screen. Replace it
                    only if you need a new copy; the old Apple Calendar subscription will stop.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border bg-muted/40 p-4">
                  <p className="font-semibold">No Apple Calendar subscription is active.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate a private link, copy it, and add it as a subscribed calendar.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" onClick={generate} disabled={busy}>
                  {generateSubscription.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {status?.active ? "Replace private link" : "Generate subscription link"}
                </Button>
                {status?.active ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={revoke}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Revoke subscription
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="glass-card space-y-6 rounded-3xl p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-1 h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">Add it to Apple Calendar</h2>
              <p className="mt-1 text-muted-foreground">
                Copy the link above first. This creates a subscription, not a one-time import.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border p-5">
              <h3 className="font-bold">iPhone or iPad</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Open Settings, then Apps, then Calendar.</li>
                <li>Choose Calendar Accounts, then Add Account.</li>
                <li>Choose Other, then Add Subscribed Calendar.</li>
                <li>Paste the MeetMinder subscription link into Server.</li>
                <li>Choose Next, leave SSL enabled, then choose Save.</li>
              </ol>
            </div>
            <div className="rounded-2xl border p-5">
              <h3 className="font-bold">Mac</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Open the Calendar app.</li>
                <li>Choose File, then New Calendar Subscription.</li>
                <li>Paste the MeetMinder subscription link and choose Subscribe.</li>
                <li>Name the calendar and set Auto-refresh to the shortest available interval.</li>
                <li>Choose OK.</li>
              </ol>
            </div>
          </div>

          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Apple controls subscription refresh timing, so changes may not appear immediately.
            Do not share the private link. If it is exposed, replace or revoke it here.
          </p>
        </section>
      </div>
    </Layout>
  );
}
