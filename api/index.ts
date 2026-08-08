// @ts-nocheck
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const defaultToken = "admin/ark/felixdgreat";

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

export default async function handler(request, response) {
  const path = request.url.split("?")[0].replace(/^\/api/, "");
  const token = String(request.headers["x-calendar-token"] || defaultToken);

  try {
    if (path === "/healthz") return response.status(200).json({ status: "ok" });
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
