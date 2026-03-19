import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const notificationLogTable = pgTable(
  "notification_log",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id").notNull(),
    reminderMinutes: integer("reminder_minutes").notNull(),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: unique().on(t.meetingId, t.reminderMinutes, t.fireAt),
  })
);

export type NotificationLog = typeof notificationLogTable.$inferSelect;
