import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";

const router: IRouter = Router();

function safeLog(label: string, err: unknown) {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(label, msg);
  } catch {
    console.error(label, "(could not stringify error)");
  }
}

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

router.get("/meetings", async (_req, res) => {
  try {
    const meetings = await db
      .select()
      .from(meetingsTable)
      .orderBy(meetingsTable.startTime);
    res.json(meetings);
  } catch (err) {
    safeLog("GET /meetings error:", err);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

router.post("/meetings", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;

    const title = str(b.title);
    if (!title) return res.status(400).json({ error: "title is required" });

    const startTime = toDate(b.startTime);
    if (!startTime) return res.status(400).json({ error: "Valid startTime is required" });

    const [meeting] = await db
      .insert(meetingsTable)
      .values({
        title,
        description: str(b.description),
        startTime,
        endTime: toDate(b.endTime),
        timezone: str(b.timezone),
        location: str(b.location),
        organizer: str(b.organizer),
        meetingUrl: str(b.meetingUrl),
        notes: str(b.notes),
        reminderMinutes: num(b.reminderMinutes) ?? 15,
        reminderMinutes2: num(b.reminderMinutes2),
        reminderMinutes3: num(b.reminderMinutes3),
        color: str(b.color) ?? "#6366f1",
      })
      .returning();

    res.status(201).json(meeting);
  } catch (err) {
    safeLog("POST /meetings error:", err);
    const message = err instanceof Error ? err.message : "Failed to create meeting";
    res.status(500).json({ error: message });
  }
});

router.get("/meetings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [meeting] = await db
      .select()
      .from(meetingsTable)
      .where(eq(meetingsTable.id, id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  } catch (err) {
    safeLog("GET /meetings/:id error:", err);
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
});

router.put("/meetings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (b.title !== undefined) updateData.title = str(b.title);
    if (b.description !== undefined) updateData.description = str(b.description);
    if (b.startTime !== undefined) {
      const d = toDate(b.startTime);
      if (d) updateData.startTime = d;
    }
    if (b.endTime !== undefined) updateData.endTime = toDate(b.endTime);
    if (b.timezone !== undefined) updateData.timezone = str(b.timezone);
    if (b.location !== undefined) updateData.location = str(b.location);
    if (b.organizer !== undefined) updateData.organizer = str(b.organizer);
    if (b.meetingUrl !== undefined) updateData.meetingUrl = str(b.meetingUrl);
    if (b.notes !== undefined) updateData.notes = str(b.notes);
    if (b.reminderMinutes !== undefined) updateData.reminderMinutes = num(b.reminderMinutes);
    if (b.reminderMinutes2 !== undefined) updateData.reminderMinutes2 = num(b.reminderMinutes2);
    if (b.reminderMinutes3 !== undefined) updateData.reminderMinutes3 = num(b.reminderMinutes3);
    if (b.color !== undefined) updateData.color = str(b.color);

    const [meeting] = await db
      .update(meetingsTable)
      .set(updateData)
      .where(eq(meetingsTable.id, id))
      .returning();

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  } catch (err) {
    safeLog("PUT /meetings/:id error:", err);
    const message = err instanceof Error ? err.message : "Failed to update meeting";
    res.status(500).json({ error: message });
  }
});

router.delete("/meetings/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(meetingsTable)
      .where(eq(meetingsTable.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Meeting not found" });
    res.json({ success: true });
  } catch (err) {
    safeLog("DELETE /meetings/:id error:", err);
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

export default router;
