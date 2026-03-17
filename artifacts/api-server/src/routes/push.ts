import { Router, type IRouter } from "express";
import webPush from "web-push";
import { db, pushSubscriptionsTable, meetingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BM4A8xrDgKpyDmGEpDZlROCwsijp8uvy4a-EnW2zNDdCqE3FF0Idg67CwNJq2lPLsu0xl6jNBrPCYLDaylc5Ypo";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "YzukqYDQpFl0ll7euuU3HnW0Of_0a-JRl43r_ZRqQCo";

webPush.setVapidDetails(
  "mailto:meetmind@app.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

function safeLog(label: string, err: unknown) {
  try {
    console.error(label, err instanceof Error ? err.message : String(err));
  } catch {
    console.error(label, "(error)");
  }
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
// Runs every 60 seconds. Sends a push notification for any meeting whose
// reminderMinutes window starts within this tick interval.

async function sendReminderNotifications() {
  try {
    const now = new Date();
    const checkAheadMs = 65 * 1000; // slightly over 60s to avoid gaps

    const meetings = await db.select().from(meetingsTable);
    const subs = await db.select().from(pushSubscriptionsTable);
    if (!subs.length) return;

    for (const meeting of meetings) {
      const start = new Date(meeting.startTime);
      const reminderMs = (meeting.reminderMinutes ?? 15) * 60 * 1000;
      const fireAt = new Date(start.getTime() - reminderMs);

      // Fire if the reminder window falls within the next tick
      if (fireAt >= now && fireAt < new Date(now.getTime() + checkAheadMs)) {
        const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);
        let timeLabel: string;
        if (minutesUntil >= 1440) {
          const days = Math.round(minutesUntil / 1440);
          timeLabel = `${days} day${days !== 1 ? "s" : ""}`;
        } else if (minutesUntil >= 60) {
          const hrs = Math.round(minutesUntil / 60);
          timeLabel = `${hrs} hour${hrs !== 1 ? "s" : ""}`;
        } else {
          timeLabel = `${minutesUntil} minute${minutesUntil !== 1 ? "s" : ""}`;
        }

        const payload = JSON.stringify({
          title: `⏰ Meeting in ${timeLabel}`,
          body: `${meeting.title}${meeting.organizer ? ` · ${meeting.organizer}` : ""}`,
          tag: `meeting-${meeting.id}`,
          data: { meetingId: meeting.id, url: "/" },
        });

        for (const sub of subs) {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (e: unknown) {
            // 410 = subscription expired/gone — clean it up
            if (e && typeof e === "object" && "statusCode" in e && (e as { statusCode: number }).statusCode === 410) {
              await db
                .delete(pushSubscriptionsTable)
                .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
            }
          }
        }

        console.log(`Push sent: "${meeting.title}" (in ${timeLabel})`);
      }
    }
  } catch (err) {
    safeLog("Scheduler error:", err);
  }
}

// Start scheduler
setInterval(sendReminderNotifications, 60 * 1000);
console.log("Push notification scheduler started");

export default router;
