import { Router, type IRouter } from "express";
import webPush from "web-push";
import { db, pushSubscriptionsTable, meetingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BM4A8xrDgKpyDmGEpDZlROCwsijp8uvy4a-EnW2zNDdCqE3FF0Idg67CwNJq2lPLsu0xl6jNBrPCYLDaylc5Ypo";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "YzukqYDQpFl0ll7euuU3HnW0Of_0a-JRl43r_ZRqQCo";

webPush.setVapidDetails("mailto:meetmind@app.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function safeLog(label: string, err: unknown) {
  try {
    console.error(label, err instanceof Error ? err.message : String(err));
  } catch {
    console.error(label, "(error)");
  }
}

function timeLabel(minutesUntil: number): string {
  if (minutesUntil >= 1440) {
    const days = Math.round(minutesUntil / 1440);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  if (minutesUntil >= 60) {
    const hrs = Math.round(minutesUntil / 60);
    return `${hrs} hour${hrs !== 1 ? "s" : ""}`;
  }
  return `${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`;
}

// Return public key so the frontend can subscribe
router.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save a new push subscription
router.post("/push/subscribe", async (req, res) => {
  try {
    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await db
      .insert(pushSubscriptionsTable)
      .values({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { p256dh: keys.p256dh, auth: keys.auth },
      });
    res.json({ success: true });
  } catch (err) {
    safeLog("POST /push/subscribe error:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// Remove a push subscription
router.post("/push/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body as { endpoint: string };
    if (endpoint) {
      await db
        .delete(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.endpoint, endpoint));
    }
    res.json({ success: true });
  } catch (err) {
    safeLog("POST /push/unsubscribe error:", err);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// ── Background scheduler ──────────────────────────────────────────────────────
// Runs every 60 seconds. For each meeting, checks all configured reminder slots
// and sends a push notification for any whose fire-time falls in this tick.
// An in-memory sent-log prevents duplicates when tick windows overlap.

// key: "meetingId-reminderMins-fireAtMinute" → timestamp when last sent
const sentLog = new Map<string, number>();

async function sendReminderNotifications() {
  try {
    const now = new Date();
    // Look back 65 s so a slightly-delayed tick never misses a reminder.
    // The sentLog prevents the same notification firing twice.
    const windowStart = new Date(now.getTime() - 65 * 1000);

    const meetings = await db.select().from(meetingsTable);
    const subs = await db.select().from(pushSubscriptionsTable);
    if (!subs.length) return;

    // Purge stale sentLog entries (older than 10 minutes)
    const pruneThreshold = now.getTime() - 10 * 60 * 1000;
    for (const [k, t] of sentLog) {
      if (t < pruneThreshold) sentLog.delete(k);
    }

    for (const meeting of meetings) {
      const start = new Date(meeting.startTime);

      // Gather all non-null reminder values for this meeting
      const reminderSlots: number[] = [
        meeting.reminderMinutes,
        meeting.reminderMinutes2,
        meeting.reminderMinutes3,
      ].filter((v): v is number => v !== null && v !== undefined);

      for (const mins of reminderSlots) {
        const fireAt = new Date(start.getTime() - mins * 60 * 1000);

        // Check if this fire-time falls within the current window
        if (fireAt >= windowStart && fireAt <= now) {
          // Deduplicate: skip if we already sent this reminder in the last 5 minutes
          const dedupKey = `m${meeting.id}-r${mins}-${Math.floor(fireAt.getTime() / 60000)}`;
          if (sentLog.has(dedupKey)) continue;
          sentLog.set(dedupKey, now.getTime());
          const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);
          const label = timeLabel(minutesUntil);

          const payload = JSON.stringify({
            title: `⏰ Meeting in ${label}`,
            body: `${meeting.title}${meeting.organizer ? ` · ${meeting.organizer}` : ""}`,
            // unique tag per meeting+reminder so multiple reminders don't replace each other
            tag: `meeting-${meeting.id}-r${mins}`,
            data: { meetingId: meeting.id, url: "/" },
          });

          for (const sub of subs) {
            try {
              await webPush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
            } catch (e: unknown) {
              if (e && typeof e === "object" && "statusCode" in e && (e as { statusCode: number }).statusCode === 410) {
                await db
                  .delete(pushSubscriptionsTable)
                  .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
              }
            }
          }

          console.log(`Push sent: "${meeting.title}" — reminder at ${mins} min (in ${label})`);
        }
      }
    }
  } catch (err) {
    safeLog("Scheduler error:", err);
  }
}

setInterval(sendReminderNotifications, 60 * 1000);
console.log("Push notification scheduler started");

export default router;
