// @ts-nocheck
import pg from "pg";
import { createClerkClient } from "@clerk/backend";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
});
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const meetingSchema = {
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
  const parties = [
    "https://smart-meeting-minder.vercel.app",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "http://localhost:5173",
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
            text: `Extract the meeting details from this image. Identify the host or organizer, not merely the attendee. Resolve relative dates using today's date, ${new Date().toISOString().slice(0, 10)}. Return startTime and endTime as ISO 8601 timestamps with the correct UTC offset. Use an IANA timezone name when it can be determined. Use null for information that is not visible.`,
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
          name: "meeting_details",
          strict: true,
          schema: meetingSchema,
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

  return response.status(200).json(JSON.parse(outputText));
}

export default async function handler(request, response) {
  const path = request.url.split("?")[0].replace(/^\/api/, "");

  try {
    if (path === "/healthz") return response.status(200).json({ status: "ok" });
    const userId = await authenticatedUserId(request);
    if (!userId) return response.status(401).json({ error: "Sign in required" });

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
        const result = await pool.query("DELETE FROM meetings WHERE id = $1 AND calendar_token = $2", [id, userId]);
        if (!result.rowCount) return response.status(404).json({ error: "Meeting not found" });
        return response.status(200).json({ success: true });
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
