import { Router, type IRouter } from "express";
import { db, meetingsTable } from "@workspace/db";

const router: IRouter = Router();

const API_KEY = process.env.MEETMIND_API_KEY || "ff29b04cc8e13580c3db8f804724c44a82c2af459b7b7395ccd75f5dfa10ec91";

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function str(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val);
}

function num(val: unknown): number | null {
  if (val === undefined || val === null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Combine date + time strings into a UTC Date.
// Accepts: "2026-03-25" + "14:00" → Date
function combineDatetime(date: unknown, time: unknown, tz?: string): Date | null {
  if (!date) return null;
  const timeStr = time ? String(time) : "00:00";
  const iso = `${String(date)}T${timeStr.length === 5 ? timeStr : timeStr.padStart(5, "0")}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// ── POST /api/webhook/booking ─────────────────────────────────────────────────
// Accepts booking payloads from appointment.expeditionamerica.us and creates
// a MeetMind meeting. The request must include:
//   Authorization: Bearer <MEETMIND_API_KEY>
//   — OR —
//   X-Api-Key: <MEETMIND_API_KEY>
//
// The body is logged raw so we can inspect the format and tune the mapping.

router.post("/webhook/booking", async (req, res) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers["authorization"] ?? "";
  const xApiKey = req.headers["x-api-key"] ?? "";
  const provided =
    (typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "") ||
    String(xApiKey);

  if (!API_KEY || provided !== API_KEY) {
    console.warn(`Webhook: rejected request — bad or missing API key. Provided: "${provided?.slice(0, 8)}..."`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Log raw body for diagnostics ──────────────────────────────────────────
  console.log("Webhook /booking received:", JSON.stringify(req.body, null, 2));

  try {
    const b = req.body as Record<string, unknown>;

    // ── Flexible field mapping ────────────────────────────────────────────────
    // Supports both MeetMind native format and common booking system formats.

    // Title: title | service | appointmentType | type | subject
    const title =
      str(b.title) ??
      str(b.service) ??
      str(b.appointmentType) ??
      str(b.type) ??
      str(b.subject) ??
      "New Appointment";

    // Start time: startTime | start | datetime | date+time | appointmentDate+appointmentTime
    let startTime =
      toDate(b.startTime) ??
      toDate(b.start) ??
      toDate(b.datetime) ??
      toDate(b.scheduledAt) ??
      combineDatetime(b.date, b.time) ??
      combineDatetime(b.appointmentDate, b.appointmentTime);

    if (!startTime) {
      console.warn("Webhook: could not parse startTime from body:", JSON.stringify(b));
      return res.status(400).json({ error: "Could not parse a start time from the booking data. Raw body has been logged." });
    }

    // End time
    let endTime =
      toDate(b.endTime) ??
      toDate(b.end) ??
      toDate(b.endsAt);

    // Default: 1-hour duration if no end time provided
    if (!endTime) {
      const duration = num(b.durationMinutes) ?? num(b.duration) ?? 60;
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    }

    // Organizer: from | organizer | hostName | staffName | bookedBy
    const organizer =
      str(b.organizer) ??
      str(b.from) ??
      str(b.hostName) ??
      str(b.staffName) ??
      str(b.bookedBy);

    // Guest/client info builds description if available
    const guestName = str(b.guestName) ?? str(b.clientName) ?? str(b.name) ?? str(b.customerName);
    const guestEmail = str(b.guestEmail) ?? str(b.clientEmail) ?? str(b.email) ?? str(b.customerEmail);
    const guestPhone = str(b.guestPhone) ?? str(b.clientPhone) ?? str(b.phone);

    const descParts: string[] = [];
    if (guestName) descParts.push(`Client: ${guestName}`);
    if (guestEmail) descParts.push(`Email: ${guestEmail}`);
    if (guestPhone) descParts.push(`Phone: ${guestPhone}`);
    if (b.notes) descParts.push(`Notes: ${str(b.notes)}`);
    if (b.message) descParts.push(`Message: ${str(b.message)}`);
    const description = str(b.description) ?? (descParts.length ? descParts.join("\n") : null);

    const [meeting] = await db
      .insert(meetingsTable)
      .values({
        title,
        description,
        startTime,
        endTime,
        timezone: str(b.timezone),
        location: str(b.location) ?? str(b.venue),
        organizer,
        meetingUrl: str(b.meetingUrl) ?? str(b.joinUrl) ?? str(b.zoomUrl) ?? str(b.link),
        notes: str(b.internalNotes) ?? str(b.adminNotes),
        reminderMinutes: num(b.reminderMinutes) ?? 15,
        reminderMinutes2: num(b.reminderMinutes2) ?? 60,
        color: str(b.color) ?? "#10b981",
      })
      .returning();

    console.log(`Webhook: created meeting #${meeting.id} — "${meeting.title}" at ${meeting.startTime}`);
    res.status(201).json({ success: true, meeting });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook /booking error:", msg);
    res.status(500).json({ error: "Failed to create meeting from booking" });
  }
});

export default router;
