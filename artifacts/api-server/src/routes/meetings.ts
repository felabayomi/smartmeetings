import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  CreateMeetingBody,
  UpdateMeetingBody,
  GetMeetingParams,
  UpdateMeetingParams,
  DeleteMeetingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/meetings", async (_req, res) => {
  try {
    const meetings = await db
      .select()
      .from(meetingsTable)
      .orderBy(meetingsTable.startTime);
    res.json(meetings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

router.post("/meetings", async (req, res) => {
  try {
    const body = CreateMeetingBody.parse(req.body);
    const [meeting] = await db
      .insert(meetingsTable)
      .values({
        title: body.title,
        description: body.description ?? null,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        timezone: body.timezone ?? null,
        location: body.location ?? null,
        organizer: body.organizer ?? null,
        meetingUrl: body.meetingUrl ?? null,
        notes: body.notes ?? null,
        reminderMinutes: body.reminderMinutes ?? 15,
        color: body.color ?? "#6366f1",
      })
      .returning();
    res.status(201).json(meeting);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid meeting data" });
  }
});

router.get("/meetings/:id", async (req, res) => {
  try {
    const { id } = GetMeetingParams.parse({ id: Number(req.params.id) });
    const [meeting] = await db
      .select()
      .from(meetingsTable)
      .where(eq(meetingsTable.id, id));
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    res.json(meeting);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/meetings/:id", async (req, res) => {
  try {
    const { id } = UpdateMeetingParams.parse({ id: Number(req.params.id) });
    const body = UpdateMeetingBody.parse(req.body);
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime);
    if (body.endTime !== undefined) updateData.endTime = body.endTime ? new Date(body.endTime) : null;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.organizer !== undefined) updateData.organizer = body.organizer;
    if (body.meetingUrl !== undefined) updateData.meetingUrl = body.meetingUrl;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.reminderMinutes !== undefined) updateData.reminderMinutes = body.reminderMinutes;
    if (body.color !== undefined) updateData.color = body.color;

    const [meeting] = await db
      .update(meetingsTable)
      .set(updateData)
      .where(eq(meetingsTable.id, id))
      .returning();
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    res.json(meeting);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/meetings/:id", async (req, res) => {
  try {
    const { id } = DeleteMeetingParams.parse({ id: Number(req.params.id) });
    const [deleted] = await db
      .delete(meetingsTable)
      .where(eq(meetingsTable.id, id))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
