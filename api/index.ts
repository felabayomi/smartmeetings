// @ts-nocheck
import pg from "pg";
import { createClerkClient } from "@clerk/backend";
import { randomUUID } from "node:crypto";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
});
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
let schedulingReady;

const defaultAvailability = [
  { day: 1, enabled: true, start: "09:00", end: "17:00" },
  { day: 2, enabled: true, start: "09:00", end: "17:00" },
  { day: 3, enabled: true, start: "09:00", end: "17:00" },
  { day: 4, enabled: true, start: "09:00", end: "17:00" },
  { day: 5, enabled: true, start: "09:00", end: "17:00" },
  { day: 6, enabled: false, start: "09:00", end: "17:00" },
  { day: 0, enabled: false, start: "09:00", end: "17:00" },
];

function ensureSchedulingTables() {
  if (!schedulingReady) schedulingReady = pool.query(`
    CREATE TABLE IF NOT EXISTS scheduling_profiles (
      user_id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      timezone TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      buffer_minutes INTEGER NOT NULL DEFAULT 0,
      always_available BOOLEAN NOT NULL DEFAULT FALSE,
      max_bookings_per_day INTEGER,
      availability JSONB NOT NULL DEFAULT '[]'::jsonb,
      blackouts JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_timezone TEXT,
      notes TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS scheduling_profile_aliases (
      alias TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES scheduling_profiles(user_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS scheduling_polls (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      timezone TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      options JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      final_start TIMESTAMPTZ,
      meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS poll_responses (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL REFERENCES scheduling_polls(id) ON DELETE CASCADE,
      participant_name TEXT NOT NULL,
      participant_email TEXT,
      participant_timezone TEXT,
      selections JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS bookings_owner_time_idx ON bookings(owner_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS poll_responses_poll_idx ON poll_responses(poll_id);
    ALTER TABLE scheduling_profiles ADD COLUMN IF NOT EXISTS always_available BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE scheduling_profiles ADD COLUMN IF NOT EXISTS max_bookings_per_day INTEGER;
    ALTER TABLE scheduling_profiles ADD COLUMN IF NOT EXISTS blackouts JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS manage_token TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_manage_token_idx ON bookings(manage_token) WHERE manage_token IS NOT NULL;
  `);
  return schedulingReady;
}

function slugify(value) {
  return String(value || "meetmind-user").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "meetmind-user";
}

function validTimezone(value) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}

function publicProfile(row) {
  return { slug: row.slug, displayName: row.display_name, timezone: row.timezone, durationMinutes: row.duration_minutes, bufferMinutes: row.buffer_minutes };
}

async function getProfileBySlug(slug) {
  await ensureSchedulingTables();
  const result = await pool.query(`SELECT * FROM scheduling_profiles WHERE slug = $1
    UNION ALL
    SELECT profile.* FROM scheduling_profile_aliases alias JOIN scheduling_profiles profile ON profile.user_id = alias.user_id WHERE alias.alias = $1
    LIMIT 1`, [slug]);
  return result.rows[0] || null;
}

function slotCandidates(profile, from = new Date(), days = 30) {
  const slots = [];
  const duration = Number(profile.duration_minutes);
  const availability = Array.isArray(profile.availability) ? profile.availability : defaultAvailability;
  const ownerDate = formatInTimeZone(from, profile.timezone, "yyyy-MM-dd");
  const baseDate = new Date(`${ownerDate}T12:00:00Z`);
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(baseDate, offset);
    const dateText = date.toISOString().slice(0, 10);
    if (dateText === ownerDate) continue;
    const day = date.getUTCDay();
    const window = profile.always_available
      ? { enabled: true, allDay: true, start: "00:00", end: "24:00" }
      : availability.find((item) => Number(item.day) === day && item.enabled);
    if (!window) continue;
    const startText = window.allDay ? "00:00" : window.start;
    const endText = window.allDay ? "24:00" : window.end;
    let cursor = fromZonedTime(`${dateText}T${startText}:00`, profile.timezone);
    const end = endText === "24:00"
      ? fromZonedTime(`${addDays(date, 1).toISOString().slice(0, 10)}T00:00:00`, profile.timezone)
      : fromZonedTime(`${dateText}T${endText}:00`, profile.timezone);
    while (addMinutes(cursor, duration) <= end) {
      if (cursor > addMinutes(new Date(), 30)) slots.push({ startTime: cursor.toISOString(), endTime: addMinutes(cursor, duration).toISOString() });
      cursor = addMinutes(cursor, duration + Number(profile.buffer_minutes || 0));
    }
  }
  return slots;
}

function overlapsBlackout(slot, profile) {
  const blackouts = Array.isArray(profile.blackouts) ? profile.blackouts : [];
  const ownerDate = formatInTimeZone(slot.startTime, profile.timezone, "yyyy-MM-dd");
  return blackouts.some((blackout) => {
    if (blackout.date !== ownerDate) return false;
    if (blackout.allDay) return true;
    const start = fromZonedTime(`${blackout.date}T${blackout.start}:00`, profile.timezone);
    const end = fromZonedTime(`${blackout.date}T${blackout.end}:00`, profile.timezone);
    return new Date(slot.startTime) < end && new Date(slot.endTime) > start;
  });
}

async function availableSlots(profile, from = new Date(), days = 30, exclude = {}) {
  const candidates = slotCandidates(profile, from, Math.min(days, 60)).filter((slot) => !overlapsBlackout(slot, profile));
  if (!candidates.length) return [];
  const end = candidates[candidates.length - 1].endTime;
  const buffer = Number(profile.buffer_minutes || 0);
  const firstOwnerDate = formatInTimeZone(candidates[0].startTime, profile.timezone, "yyyy-MM-dd");
  const lastOwnerDate = formatInTimeZone(candidates[candidates.length - 1].startTime, profile.timezone, "yyyy-MM-dd");
  const bookingRangeStart = fromZonedTime(`${firstOwnerDate}T00:00:00`, profile.timezone).toISOString();
  const bookingRangeEndDate = addDays(new Date(`${lastOwnerDate}T12:00:00Z`), 1).toISOString().slice(0, 10);
  const bookingRangeEnd = fromZonedTime(`${bookingRangeEndDate}T00:00:00`, profile.timezone).toISOString();
  const [busy, bookings] = await Promise.all([
    pool.query("SELECT start_time, COALESCE(end_time, start_time + interval '30 minutes') AS end_time FROM meetings WHERE calendar_token = $1 AND ($5::int IS NULL OR id <> $5) AND start_time < ($2::timestamptz + ($4::int * interval '1 minute')) AND COALESCE(end_time, start_time + interval '30 minutes') > ($3::timestamptz - ($4::int * interval '1 minute'))", [profile.user_id, end, candidates[0].startTime, buffer, exclude.meetingId || null]),
    profile.max_bookings_per_day ? pool.query("SELECT start_time FROM bookings WHERE owner_id = $1 AND ($4::text IS NULL OR id <> $4) AND start_time >= $2 AND start_time < $3", [profile.user_id, bookingRangeStart, bookingRangeEnd, exclude.bookingId || null]) : Promise.resolve({ rows: [] }),
  ]);
  const bookingsPerDay = new Map();
  bookings.rows.forEach((item) => {
    const date = formatInTimeZone(item.start_time, profile.timezone, "yyyy-MM-dd");
    bookingsPerDay.set(date, (bookingsPerDay.get(date) || 0) + 1);
  });
  return candidates.filter((slot) => {
    const date = formatInTimeZone(slot.startTime, profile.timezone, "yyyy-MM-dd");
    if (profile.max_bookings_per_day && (bookingsPerDay.get(date) || 0) >= profile.max_bookings_per_day) return false;
    return !busy.rows.some((item) => new Date(item.start_time) < addMinutes(new Date(slot.endTime), buffer) && addMinutes(new Date(item.end_time), buffer) > new Date(slot.startTime));
  });
}

function normalizeBlackouts(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((item) => {
    const date = typeof item?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
    if (!date) return [];
    if (item.allDay) return [{ id: String(item.id || randomUUID()), date, allDay: true, start: "00:00", end: "24:00" }];
    if (!/^\d{2}:\d{2}$/.test(item.start || "") || !/^\d{2}:\d{2}$/.test(item.end || "") || item.start >= item.end) return [];
    return [{ id: String(item.id || randomUUID()), date, allDay: false, start: item.start, end: item.end }];
  });
}

function pollPayload(row, responses = []) {
  const counts = Object.fromEntries((row.options || []).map((option) => [option, 0]));
  responses.forEach((response) => (response.selections || []).forEach((option) => { if (option in counts) counts[option]++; }));
  return { id: row.id, slug: row.slug, title: row.title, description: row.description, timezone: row.timezone, durationMinutes: row.duration_minutes, options: row.options, status: row.status, finalStart: row.final_start, counts, responseCount: responses.length };
}

const extractedMeetingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    startTime: { type: ["string", "null"] },
    endTime: { type: ["string", "null"] },
    timezone: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    organizer: { type: ["string", "null"] },
    meetingUrl: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
  },
  required: [
    "title", "description", "startTime", "endTime", "timezone",
    "location", "organizer", "meetingUrl", "notes", "confidence",
  ],
};

const meetingBatchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    meetings: {
      type: "array",
      minItems: 1,
      maxItems: 25,
      items: extractedMeetingSchema,
    },
  },
  required: ["meetings"],
};

function meeting(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    location: row.location,
    organizer: row.organizer,
    meetingUrl: row.meeting_url,
    notes: row.notes,
    reminderMinutes: row.reminder_minutes,
    reminderMinutes2: row.reminder_minutes_2,
    reminderMinutes3: row.reminder_minutes_3,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function webRequest(request) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value != null) headers.set(key, String(value));
  }
  return new Request(`${protocol}://${host}${request.url}`, { method: request.method, headers });
}

async function authenticatedUserId(request) {
  if (!process.env.CLERK_SECRET_KEY) throw new Error("Clerk is not configured");
  const configuredParties = (process.env.AUTHORIZED_PARTIES || "")
    .split(",")
    .map((party) => party.trim())
    .filter(Boolean);
  const parties = [
    "https://smart-meeting-minder.vercel.app",
    "https://meetminder.app",
    "https://www.meetminder.app",
    "https://meetmind.us",
    "https://www.meetmind.us",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:5173",
    ...configuredParties,
  ].filter(Boolean);
  const state = await clerk.authenticateRequest(webRequest(request), {
    authorizedParties: parties,
    acceptsToken: "session_token",
  });
  if (!state.isAuthenticated) return null;
  return state.toAuth().userId || null;
}

const editableFields = {
  title: "title",
  description: "description",
  startTime: "start_time",
  endTime: "end_time",
  timezone: "timezone",
  location: "location",
  organizer: "organizer",
  meetingUrl: "meeting_url",
  notes: "notes",
  reminderMinutes: "reminder_minutes",
  reminderMinutes2: "reminder_minutes_2",
  reminderMinutes3: "reminder_minutes_3",
  color: "color",
};

function meetingValues(body, partial = false) {
  const result = {};
  for (const key of Object.keys(editableFields)) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) result[key] = body[key];
  }
  if (!partial && (typeof result.title !== "string" || !result.title.trim())) throw new Error("Title is required");
  if (!partial && !result.startTime) throw new Error("Start time is required");
  return result;
}

async function extractMeeting(request, response) {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) return response.status(503).json({ error: "AI scanning is not configured" });

  const { imageBase64, mimeType } = request.body || {};
  if (typeof imageBase64 !== "string" || !allowedImageTypes.has(mimeType)) {
    return response.status(400).json({ error: "Upload a PNG, JPEG, WebP, or GIF image" });
  }
  if (imageBase64.length > 11_000_000) {
    return response.status(413).json({ error: "Image is too large; use an image under 8 MB" });
  }

  const openaiResponse = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      reasoning: { effort: "low" },
      max_output_tokens: 1800,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Extract EVERY distinct meeting, appointment, or schedule row visible in this image, in top-to-bottom order. Return one array item per distinct event; never merge separate rows. Identify the named person as organizer when appropriate. If no event title is shown, use "Meeting with [person's name]" rather than inventing a generic title. Resolve relative dates using today's date, ${new Date().toISOString().slice(0, 10)}. Return startTime and endTime as ISO 8601 timestamps with the correct UTC offset. Use an IANA timezone name when it can be determined. When an end time, location, URL, or other value is not visible, return null and do not guess. Preserve explicit time-zone equivalences from the image.`,
          },
          {
            type: "input_image",
            image_url: `data:${mimeType};base64,${imageBase64}`,
            detail: "high",
          },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "meeting_batch",
          strict: true,
          schema: meetingBatchSchema,
        },
      },
    }),
  });

  const result = await openaiResponse.json();
  if (!openaiResponse.ok) {
    console.error("OpenAI extraction failed", openaiResponse.status, result?.error?.code || "unknown");
    return response.status(502).json({ error: "AI could not read this image" });
  }

  const outputText = result.output_text || result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) return response.status(502).json({ error: "AI returned no meeting details" });

  const parsed = JSON.parse(outputText);
  if (!Array.isArray(parsed.meetings) || !parsed.meetings.length) {
    return response.status(502).json({ error: "AI found no meeting details" });
  }
  return response.status(200).json(parsed);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Authorization");
  const path = request.url.split("?")[0].replace(/^\/api/, "");

  try {
    if (path === "/healthz") return response.status(200).json({ status: "ok" });

    const publicBooking = path.match(/^\/booking\/([^/]+)$/);
    const publicSlots = path.match(/^\/booking\/([^/]+)\/slots$/);
    if (publicSlots && request.method === "GET") {
      const profile = await getProfileBySlug(decodeURIComponent(publicSlots[1]));
      if (!profile) return response.status(404).json({ error: "Booking page not found" });
      const slots = await availableSlots(profile, new Date(), Number(request.query?.days || 30));
      return response.status(200).json({ profile: publicProfile(profile), slots });
    }
    if (publicBooking && request.method === "GET") {
      const profile = await getProfileBySlug(decodeURIComponent(publicBooking[1]));
      if (!profile) return response.status(404).json({ error: "Booking page not found" });
      return response.status(200).json(publicProfile(profile));
    }
    if (publicBooking && request.method === "POST") {
      const profile = await getProfileBySlug(decodeURIComponent(publicBooking[1]));
      if (!profile) return response.status(404).json({ error: "Booking page not found" });
      const { startTime, guestName, guestEmail, guestTimezone, notes } = request.body || {};
      if (!startTime || !guestName?.trim() || !guestEmail?.includes("@")) return response.status(400).json({ error: "Name, email, and a time are required" });
      const allowed = await availableSlots(profile, new Date(), 60);
      const selected = allowed.find((slot) => slot.startTime === new Date(startTime).toISOString());
      if (!selected) return response.status(409).json({ error: "That time is no longer available" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [profile.user_id]);
        if (profile.max_bookings_per_day) {
          const ownerDate = formatInTimeZone(selected.startTime, profile.timezone, "yyyy-MM-dd");
          const dayStart = fromZonedTime(`${ownerDate}T00:00:00`, profile.timezone);
          const nextDate = addDays(new Date(`${ownerDate}T12:00:00Z`), 1).toISOString().slice(0, 10);
          const dayEnd = fromZonedTime(`${nextDate}T00:00:00`, profile.timezone);
          const dailyCount = await client.query("SELECT COUNT(*)::int AS count FROM bookings WHERE owner_id = $1 AND start_time >= $2 AND start_time < $3", [profile.user_id, dayStart.toISOString(), dayEnd.toISOString()]);
          if (dailyCount.rows[0].count >= profile.max_bookings_per_day) {
            await client.query("ROLLBACK");
            return response.status(409).json({ error: "This day has reached its booking limit" });
          }
        }
        const conflict = await client.query("SELECT 1 FROM meetings WHERE calendar_token = $1 AND start_time < ($2::timestamptz + ($4::int * interval '1 minute')) AND COALESCE(end_time, start_time + interval '30 minutes') > ($3::timestamptz - ($4::int * interval '1 minute')) LIMIT 1", [profile.user_id, selected.endTime, selected.startTime, Number(profile.buffer_minutes || 0)]);
        if (conflict.rowCount) { await client.query("ROLLBACK"); return response.status(409).json({ error: "That time was just booked" }); }
        const inserted = await client.query("INSERT INTO meetings (calendar_token,title,description,start_time,end_time,timezone,organizer,notes,color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *", [profile.user_id, `Meeting with ${guestName.trim()}`, notes || `Booked by ${guestEmail}`, selected.startTime, selected.endTime, profile.timezone, guestName.trim(), `Guest: ${guestEmail}${guestTimezone ? ` • ${guestTimezone}` : ""}${notes ? `\n${notes}` : ""}`, "#10b981"]);
        const manageToken = randomUUID();
        await client.query("INSERT INTO bookings (id,owner_id,meeting_id,guest_name,guest_email,guest_timezone,notes,start_time,end_time,manage_token) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [randomUUID(), profile.user_id, inserted.rows[0].id, guestName.trim(), guestEmail.trim(), guestTimezone || null, notes || null, selected.startTime, selected.endTime, manageToken]);
        await client.query("COMMIT");
        return response.status(201).json({ success: true, meeting: meeting(inserted.rows[0]), ownerTimezone: profile.timezone, manageToken });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    }

    const bookingManagement = path.match(/^\/booking-management\/([^/]+)$/);
    const bookingManagementSlots = path.match(/^\/booking-management\/([^/]+)\/slots$/);
    if ((bookingManagement || bookingManagementSlots) && request.method === "GET") {
      await ensureSchedulingTables();
      const token = decodeURIComponent((bookingManagementSlots || bookingManagement)[1]);
      const result = await pool.query(`SELECT booking.*, profile.user_id, profile.slug, profile.display_name, profile.timezone,
        profile.duration_minutes, profile.buffer_minutes, profile.always_available,
        profile.max_bookings_per_day, profile.availability, profile.blackouts
        FROM bookings booking JOIN scheduling_profiles profile ON profile.user_id = booking.owner_id
        WHERE booking.manage_token = $1 AND booking.meeting_id IS NOT NULL`, [token]);
      if (!result.rowCount) return response.status(404).json({ error: "Rescheduling link not found" });
      const booking = result.rows[0];
      if (new Date(booking.start_time) <= new Date()) return response.status(410).json({ error: "This meeting has started or passed and can no longer be rescheduled" });
      const payload = {
        profile: publicProfile(booking),
        booking: { guestName: booking.guest_name, startTime: booking.start_time, endTime: booking.end_time },
      };
      if (bookingManagementSlots) {
        payload.slots = await availableSlots(booking, new Date(), Number(request.query?.days || 30), { meetingId: booking.meeting_id, bookingId: booking.id });
      }
      return response.status(200).json(payload);
    }
    if (bookingManagement && (request.method === "POST" || request.method === "PUT")) {
      await ensureSchedulingTables();
      const token = decodeURIComponent(bookingManagement[1]);
      const initial = await pool.query(`SELECT booking.*, profile.user_id, profile.slug, profile.display_name, profile.timezone,
        profile.duration_minutes, profile.buffer_minutes, profile.always_available,
        profile.max_bookings_per_day, profile.availability, profile.blackouts
        FROM bookings booking JOIN scheduling_profiles profile ON profile.user_id = booking.owner_id
        WHERE booking.manage_token = $1 AND booking.meeting_id IS NOT NULL`, [token]);
      if (!initial.rowCount) return response.status(404).json({ error: "Rescheduling link not found" });
      if (new Date(initial.rows[0].start_time) <= new Date()) return response.status(410).json({ error: "This meeting can no longer be rescheduled" });
      const requestedStart = request.body?.startTime;
      if (!requestedStart) return response.status(400).json({ error: "Choose a new time" });
      const allowed = await availableSlots(initial.rows[0], new Date(), 60, { meetingId: initial.rows[0].meeting_id, bookingId: initial.rows[0].id });
      const selected = allowed.find((slot) => slot.startTime === new Date(requestedStart).toISOString());
      if (!selected) return response.status(409).json({ error: "That time is no longer available" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [initial.rows[0].owner_id]);
        const locked = await client.query("SELECT * FROM bookings WHERE manage_token = $1 AND meeting_id IS NOT NULL FOR UPDATE", [token]);
        if (!locked.rowCount || new Date(locked.rows[0].start_time) <= new Date()) {
          await client.query("ROLLBACK");
          return response.status(410).json({ error: "This meeting can no longer be rescheduled" });
        }
        const current = locked.rows[0];
        const profile = initial.rows[0];
        if (profile.max_bookings_per_day) {
          const ownerDate = formatInTimeZone(selected.startTime, profile.timezone, "yyyy-MM-dd");
          const dayStart = fromZonedTime(`${ownerDate}T00:00:00`, profile.timezone);
          const nextDate = addDays(new Date(`${ownerDate}T12:00:00Z`), 1).toISOString().slice(0, 10);
          const dayEnd = fromZonedTime(`${nextDate}T00:00:00`, profile.timezone);
          const count = await client.query("SELECT COUNT(*)::int AS count FROM bookings WHERE owner_id = $1 AND id <> $2 AND start_time >= $3 AND start_time < $4", [profile.user_id, current.id, dayStart.toISOString(), dayEnd.toISOString()]);
          if (count.rows[0].count >= profile.max_bookings_per_day) {
            await client.query("ROLLBACK");
            return response.status(409).json({ error: "This day has reached its booking limit" });
          }
        }
        const conflict = await client.query("SELECT 1 FROM meetings WHERE calendar_token = $1 AND id <> $2 AND start_time < ($3::timestamptz + ($5::int * interval '1 minute')) AND COALESCE(end_time, start_time + interval '30 minutes') > ($4::timestamptz - ($5::int * interval '1 minute')) LIMIT 1", [profile.user_id, current.meeting_id, selected.endTime, selected.startTime, Number(profile.buffer_minutes || 0)]);
        if (conflict.rowCount) {
          await client.query("ROLLBACK");
          return response.status(409).json({ error: "That time was just booked" });
        }
        await client.query("UPDATE meetings SET start_time = $1, end_time = $2, timezone = $3, updated_at = NOW() WHERE id = $4 AND calendar_token = $5", [selected.startTime, selected.endTime, profile.timezone, current.meeting_id, profile.user_id]);
        await client.query("UPDATE bookings SET start_time = $1, end_time = $2 WHERE id = $3", [selected.startTime, selected.endTime, current.id]);
        await client.query("COMMIT");
        return response.status(200).json({ success: true, profile: publicProfile(profile), booking: { guestName: current.guest_name, startTime: selected.startTime, endTime: selected.endTime } });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    }

    const publicPoll = path.match(/^\/polls\/([^/]+)$/);
    const pollResponse = path.match(/^\/polls\/([^/]+)\/responses$/);
    if (publicPoll && request.method === "GET") {
      await ensureSchedulingTables();
      const result = await pool.query("SELECT * FROM scheduling_polls WHERE slug = $1", [decodeURIComponent(publicPoll[1])]);
      if (!result.rowCount) return response.status(404).json({ error: "Poll not found" });
      const responses = await pool.query("SELECT selections FROM poll_responses WHERE poll_id = $1", [result.rows[0].id]);
      return response.status(200).json(pollPayload(result.rows[0], responses.rows));
    }
    if (pollResponse && request.method === "POST") {
      await ensureSchedulingTables();
      const poll = await pool.query("SELECT * FROM scheduling_polls WHERE slug = $1", [decodeURIComponent(pollResponse[1])]);
      if (!poll.rowCount || poll.rows[0].status !== "open") return response.status(404).json({ error: "This poll is not open" });
      const { participantName, participantEmail, participantTimezone, selections } = request.body || {};
      const valid = Array.isArray(selections) && selections.filter((option) => poll.rows[0].options.includes(option));
      if (!participantName?.trim() || !valid?.length) return response.status(400).json({ error: "Your name and at least one available time are required" });
      await pool.query("INSERT INTO poll_responses (id,poll_id,participant_name,participant_email,participant_timezone,selections) VALUES ($1,$2,$3,$4,$5,$6)", [randomUUID(), poll.rows[0].id, participantName.trim(), participantEmail || null, participantTimezone || null, JSON.stringify(valid)]);
      return response.status(201).json({ success: true });
    }

    const userId = await authenticatedUserId(request);
    if (!userId) return response.status(401).json({ error: "Sign in required" });

    if (path === "/guest-bookings" && request.method === "GET") {
      await ensureSchedulingTables();
      const clerkUser = await clerk.users.getUser(userId);
      const verifiedEmails = clerkUser.emailAddresses
        .filter((item) => item.verification?.status === "verified")
        .map((item) => item.emailAddress.toLowerCase());
      if (!verifiedEmails.length) return response.status(403).json({ error: "Verify your account email to recover bookings" });
      const result = await pool.query(`SELECT booking.id, booking.manage_token, booking.start_time, booking.end_time,
        booking.guest_name, booking.guest_email, profile.display_name, profile.timezone
        FROM bookings booking JOIN scheduling_profiles profile ON profile.user_id = booking.owner_id
        WHERE LOWER(booking.guest_email) = ANY($1::text[]) AND booking.meeting_id IS NOT NULL
        ORDER BY booking.start_time`, [verifiedEmails]);
      return response.status(200).json(result.rows.map((row) => ({
        id: row.id,
        manageToken: row.manage_token,
        guestName: row.guest_name,
        guestEmail: row.guest_email,
        hostName: row.display_name,
        ownerTimezone: row.timezone,
        startTime: row.start_time,
        endTime: row.end_time,
      })));
    }

    if (path === "/scheduling/profile" && request.method === "GET") {
      await ensureSchedulingTables();
      const existing = await pool.query("SELECT * FROM scheduling_profiles WHERE user_id = $1", [userId]);
      if (!existing.rowCount) return response.status(200).json(null);
      const row = existing.rows[0];
      const availability = row.always_available
        ? defaultAvailability.map((item) => ({ ...item, enabled: true, allDay: true, start: "00:00", end: "24:00" }))
        : (row.availability || []).map((item) => ({ ...item, allDay: Boolean(item.allDay) }));
      return response.status(200).json({ ...publicProfile(row), availability, maxBookingsPerDay: row.max_bookings_per_day, blackouts: row.blackouts });
    }
    if (path === "/scheduling/profile" && request.method === "PUT") {
      await ensureSchedulingTables();
      const body = request.body || {};
      if (!body.displayName?.trim() || !validTimezone(body.timezone)) return response.status(400).json({ error: "A display name and valid timezone are required" });
      const baseSlug = slugify(body.slug || body.displayName);
      const current = await pool.query("SELECT slug FROM scheduling_profiles WHERE user_id = $1", [userId]);
      let slug = current.rows[0]?.slug || baseSlug;
      if (!current.rowCount || (body.slug && body.slug !== slug)) {
        slug = baseSlug;
        const taken = await pool.query(`SELECT 1 FROM scheduling_profiles WHERE slug = $1 AND user_id <> $2
          UNION ALL SELECT 1 FROM scheduling_profile_aliases WHERE alias = $1 AND user_id <> $2 LIMIT 1`, [slug, userId]);
        if (taken.rowCount) slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
      }
      const availability = Array.isArray(body.availability) ? body.availability.map((item) => ({
        day: Number(item.day),
        enabled: Boolean(item.enabled),
        allDay: Boolean(item.allDay),
        start: item.allDay ? "00:00" : item.start,
        end: item.allDay ? "24:00" : item.end,
      })) : defaultAvailability;
      const maxBookingsPerDay = [1, 2, 3, 4, 5].includes(Number(body.maxBookingsPerDay)) ? Number(body.maxBookingsPerDay) : null;
      const blackouts = normalizeBlackouts(body.blackouts);
      if (current.rowCount && current.rows[0].slug !== slug) {
        await pool.query("DELETE FROM scheduling_profile_aliases WHERE alias = $1 AND user_id = $2", [slug, userId]);
        await pool.query("INSERT INTO scheduling_profile_aliases (alias,user_id) VALUES ($1,$2) ON CONFLICT (alias) DO NOTHING", [current.rows[0].slug, userId]);
      }
      const result = await pool.query(`INSERT INTO scheduling_profiles (user_id,slug,display_name,timezone,duration_minutes,buffer_minutes,availability,always_available,max_bookings_per_day,blackouts) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (user_id) DO UPDATE SET slug=EXCLUDED.slug,display_name=EXCLUDED.display_name,timezone=EXCLUDED.timezone,duration_minutes=EXCLUDED.duration_minutes,buffer_minutes=EXCLUDED.buffer_minutes,availability=EXCLUDED.availability,always_available=EXCLUDED.always_available,max_bookings_per_day=EXCLUDED.max_bookings_per_day,blackouts=EXCLUDED.blackouts,updated_at=NOW() RETURNING *`, [userId, slug, body.displayName.trim(), body.timezone, Math.max(15, Math.min(180, Number(body.durationMinutes || 30))), Math.max(0, Math.min(60, Number(body.bufferMinutes || 0))), JSON.stringify(availability), false, maxBookingsPerDay, JSON.stringify(blackouts)]);
      const row = result.rows[0];
      return response.status(200).json({ ...publicProfile(row), availability: row.availability, maxBookingsPerDay: row.max_bookings_per_day, blackouts: row.blackouts });
    }
    if (path === "/scheduling/polls" && request.method === "GET") {
      await ensureSchedulingTables();
      const polls = await pool.query("SELECT * FROM scheduling_polls WHERE owner_id = $1 ORDER BY created_at DESC", [userId]);
      const output = [];
      for (const row of polls.rows) {
        const responses = await pool.query("SELECT selections FROM poll_responses WHERE poll_id = $1", [row.id]);
        output.push(pollPayload(row, responses.rows));
      }
      return response.status(200).json(output);
    }
    if (path === "/scheduling/polls" && request.method === "POST") {
      await ensureSchedulingTables();
      const { title, description, timezone, durationMinutes, options } = request.body || {};
      const normalized = Array.isArray(options) ? [...new Set(options.map((item) => new Date(item).toISOString()))].sort() : [];
      if (!title?.trim() || !validTimezone(timezone) || normalized.length < 2) return response.status(400).json({ error: "Title, timezone, and at least two times are required" });
      const id = randomUUID();
      const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await pool.query("INSERT INTO scheduling_polls (id,owner_id,slug,title,description,timezone,duration_minutes,options) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [id, userId, slug, title.trim(), description || null, timezone, Number(durationMinutes || 30), JSON.stringify(normalized)]);
      return response.status(201).json(pollPayload(result.rows[0]));
    }
    const finalizePoll = path.match(/^\/scheduling\/polls\/([^/]+)\/finalize$/);
    if (finalizePoll && request.method === "POST") {
      await ensureSchedulingTables();
      const poll = await pool.query("SELECT * FROM scheduling_polls WHERE id = $1 AND owner_id = $2", [finalizePoll[1], userId]);
      if (!poll.rowCount || poll.rows[0].status !== "open") return response.status(404).json({ error: "Open poll not found" });
      const startTime = new Date(request.body?.startTime).toISOString();
      if (!poll.rows[0].options.includes(startTime)) return response.status(400).json({ error: "Choose a proposed time" });
      const endTime = addMinutes(new Date(startTime), poll.rows[0].duration_minutes).toISOString();
      const conflict = await pool.query("SELECT 1 FROM meetings WHERE calendar_token=$1 AND start_time < $2 AND COALESCE(end_time,start_time + interval '30 minutes') > $3 LIMIT 1", [userId, endTime, startTime]);
      if (conflict.rowCount) return response.status(409).json({ error: "That time now conflicts with your calendar" });
      const inserted = await pool.query("INSERT INTO meetings (calendar_token,title,description,start_time,end_time,timezone,notes,color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [userId, poll.rows[0].title, poll.rows[0].description, startTime, endTime, poll.rows[0].timezone, "Confirmed from a MeetMind group poll", "#8b5cf6"]);
      await pool.query("UPDATE scheduling_polls SET status='finalized',final_start=$1,meeting_id=$2 WHERE id=$3", [startTime, inserted.rows[0].id, poll.rows[0].id]);
      return response.status(200).json({ success: true, meeting: meeting(inserted.rows[0]) });
    }

    if (path === "/ai/extract-meeting" && request.method === "POST") {
      return await extractMeeting(request, response);
    }

    if (path === "/meetings" && request.method === "GET") {
      const result = await pool.query(
        "SELECT * FROM meetings WHERE calendar_token = $1 ORDER BY start_time",
        [userId],
      );
      return response.status(200).json(result.rows.map(meeting));
    }

    if (path === "/meetings" && request.method === "POST") {
      const values = meetingValues(request.body);
      const keys = Object.keys(values);
      const columns = ["calendar_token", ...keys.map((key) => editableFields[key])];
      const params = [userId, ...keys.map((key) => values[key])];
      const placeholders = params.map((_, index) => `$${index + 1}`);
      const result = await pool.query(
        `INSERT INTO meetings (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        params,
      );
      return response.status(201).json(meeting(result.rows[0]));
    }

    const match = path.match(/^\/meetings\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      if (request.method === "GET") {
        const result = await pool.query("SELECT * FROM meetings WHERE id = $1 AND calendar_token = $2", [id, userId]);
        if (!result.rowCount) return response.status(404).json({ error: "Meeting not found" });
        return response.status(200).json(meeting(result.rows[0]));
      }
      if (request.method === "PUT" || request.method === "PATCH") {
        const values = meetingValues(request.body, true);
        const keys = Object.keys(values);
        if (!keys.length) return response.status(400).json({ error: "No meeting fields supplied" });
        const assignments = keys.map((key, index) => `${editableFields[key]} = $${index + 1}`);
        const params = keys.map((key) => values[key]);
        params.push(id, userId);
        const result = await pool.query(
          `UPDATE meetings SET ${assignments.join(", ")}, updated_at = NOW() WHERE id = $${keys.length + 1} AND calendar_token = $${keys.length + 2} RETURNING *`,
          params,
        );
        if (!result.rowCount) return response.status(404).json({ error: "Meeting not found" });
        return response.status(200).json(meeting(result.rows[0]));
      }
      if (request.method === "DELETE") {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM bookings
            WHERE owner_id = $2 AND meeting_id IN (
              SELECT id FROM meetings WHERE id = $1 AND calendar_token = $2
            )`, [id, userId]);
          const result = await client.query("DELETE FROM meetings WHERE id = $1 AND calendar_token = $2", [id, userId]);
          if (!result.rowCount) {
            await client.query("ROLLBACK");
            return response.status(404).json({ error: "Meeting not found" });
          }
          await client.query("COMMIT");
          return response.status(200).json({ success: true });
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    }

    return response.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("Meeting API error", error);
    const message = error instanceof Error ? error.message : "Request failed";
    if (message === "Title is required" || message === "Start time is required") {
      return response.status(400).json({ error: message });
    }
    return response.status(500).json({ error: "Meeting request failed" });
  }
}
