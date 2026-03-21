import { Router, type IRouter } from "express";
import webPush from "web-push";
import { db, pushSubscriptionsTable, meetingsTable, notificationLogTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { getUncachableResendClient } from "../resend-client";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BM4A8xrDgKpyDmGEpDZlROCwsijp8uvy4a-EnW2zNDdCqE3FF0Idg67CwNJq2lPLsu0xl6jNBrPCYLDaylc5Ypo";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "YzukqYDQpFl0ll7euuU3HnW0Of_0a-JRl43r_ZRqQCo";

// Recipient for all email reminders
const REMINDER_EMAIL_TO = "arkgco@outlook.com";

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

function buildEmailHtml(meeting: {
  title: string;
  startTime: Date | string;
  location?: string | null;
  organizer?: string | null;
  meetingUrl?: string | null;
  description?: string | null;
}, label: string): string {
  const start = new Date(meeting.startTime);
  const dateStr = start.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const rows = [
    meeting.organizer ? `<tr><td style="color:#6b7280;padding:4px 0;width:90px">Organizer</td><td style="padding:4px 0">${meeting.organizer}</td></tr>` : "",
    meeting.location  ? `<tr><td style="color:#6b7280;padding:4px 0">Location</td><td style="padding:4px 0">${meeting.location}</td></tr>` : "",
    meeting.meetingUrl ? `<tr><td style="color:#6b7280;padding:4px 0">Link</td><td style="padding:4px 0"><a href="${meeting.meetingUrl}" style="color:#6366f1">${meeting.meetingUrl}</a></td></tr>` : "",
    meeting.description ? `<tr><td style="color:#6b7280;padding:4px 0;vertical-align:top">Notes</td><td style="padding:4px 0">${meeting.description}</td></tr>` : "",
  ].filter(Boolean).join("");

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px">
            <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;text-transform:uppercase;letter-spacing:.05em">MeetMind Reminder</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:22px;line-height:1.3">${meeting.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px">
            <div style="background:#f0f0ff;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:15px;color:#4f46e5;font-weight:600">
              ⏰ Starting in ${label}
            </div>
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px">DATE &amp; TIME</p>
            <p style="margin:0 0 20px;color:#111827;font-size:15px;font-weight:500">${dateStr}</p>
            ${rows ? `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#111827;border-top:1px solid #f3f4f6;padding-top:16px">${rows}</table>` : ""}
            ${meeting.meetingUrl ? `
            <div style="margin-top:24px;text-align:center">
              <a href="${meeting.meetingUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Join Meeting</a>
            </div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
            <p style="margin:0;color:#9ca3af;font-size:12px">Sent by MeetMind · <a href="https://smartmeetings.felixconsult.co" style="color:#9ca3af">Open app</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
// Runs every 60 seconds.
//
// Looks back 15 minutes so reminders missed during a server restart are
// caught and delivered on the next tick after the server comes back up.
//
// Deduplication is DB-backed (notification_log) so it survives restarts.
// Each triggered reminder fires BOTH a push notification AND an email.

async function sendReminderNotifications() {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    const meetings = await db.select().from(meetingsTable);
    const subs = await db.select().from(pushSubscriptionsTable);

    // Load sent-log for dedup (email + push both keyed here)
    const recentLog = await db
      .select()
      .from(notificationLogTable)
      .where(gte(notificationLogTable.fireAt, windowStart));

    const alreadySent = new Set(
      recentLog.map((r) => `m${r.meetingId}-r${r.reminderMinutes}-${r.fireAt.getTime()}`)
    );

    for (const meeting of meetings) {
      const start = new Date(meeting.startTime);

      const reminderSlots: number[] = [
        meeting.reminderMinutes,
        meeting.reminderMinutes2,
        meeting.reminderMinutes3,
      ].filter((v): v is number => v !== null && v !== undefined);

      for (const mins of reminderSlots) {
        const fireAt = new Date(start.getTime() - mins * 60 * 1000);

        if (fireAt < windowStart || fireAt > now) continue;

        const dedupKey = `m${meeting.id}-r${mins}-${fireAt.getTime()}`;
        if (alreadySent.has(dedupKey)) continue;

        // Claim this slot in DB before sending (prevents races & duplicate sends)
        try {
          await db
            .insert(notificationLogTable)
            .values({ meetingId: meeting.id, reminderMinutes: mins, fireAt })
            .onConflictDoNothing();
        } catch {
          continue;
        }
        alreadySent.add(dedupKey);

        const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);
        const label = timeLabel(minutesUntil);

        // ── Push notification ────────────────────────────────────────────────
        if (subs.length) {
          const payload = JSON.stringify({
            title: `⏰ Meeting in ${label}`,
            body: `${meeting.title}${meeting.organizer ? ` · ${meeting.organizer}` : ""}`,
            tag: `meeting-${meeting.id}-r${mins}`,
            data: { meetingId: meeting.id, url: "/admin/ark/felixdgreat" },
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
          console.log(`Push sent: "${meeting.title}" — ${mins} min reminder`);
        }

        // ── Email via Resend ─────────────────────────────────────────────────
        try {
          const { client, fromEmail } = await getUncachableResendClient();
          await client.emails.send({
            from: fromEmail || "MeetMind <reminders@smartmeetings.felixconsult.co>",
            to: REMINDER_EMAIL_TO,
            subject: `⏰ "${meeting.title}" starts in ${label}`,
            html: buildEmailHtml(meeting, label),
          });
          console.log(`Email sent: "${meeting.title}" — ${mins} min reminder → ${REMINDER_EMAIL_TO}`);
        } catch (emailErr) {
          safeLog(`Email error for "${meeting.title}":`, emailErr);
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
