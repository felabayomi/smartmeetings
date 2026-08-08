// @ts-nocheck
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const defaultToken = "admin/ark/felixdgreat";
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
    calendarToken: row.calendar_token,
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
  const token = String(request.headers["x-calendar-token"] || defaultToken);

  try {
    if (path === "/healthz") return response.status(200).json({ status: "ok" });
    if (path === "/ai/extract-meeting" && request.method === "POST") {
      return await extractMeeting(request, response);
    }
    if (path !== "/meetings" || request.method !== "GET") {
      return response.status(404).json({ error: "Not found" });
    }

    const result = await pool.query(
      "SELECT * FROM meetings WHERE calendar_token = $1 ORDER BY start_time",
      [token],
    );
    return response.status(200).json(result.rows.map(meeting));
  } catch (error) {
    console.error("Meeting API error", error);
    return response.status(500).json({ error: "Failed to fetch meetings" });
  }
}
