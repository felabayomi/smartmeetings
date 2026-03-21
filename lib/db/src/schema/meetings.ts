import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  calendarToken: text("calendar_token").notNull().default("admin/ark/felixdgreat"),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  timezone: text("timezone"),
  location: text("location"),
  organizer: text("organizer"),
  meetingUrl: text("meeting_url"),
  notes: text("notes"),
  reminderMinutes: integer("reminder_minutes").default(15),
  reminderMinutes2: integer("reminder_minutes_2"),
  reminderMinutes3: integer("reminder_minutes_3"),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
