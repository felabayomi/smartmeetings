import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSchema() {
  // notification_log table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notification_log (
      id          SERIAL PRIMARY KEY,
      meeting_id  INTEGER NOT NULL,
      reminder_minutes INTEGER NOT NULL,
      fire_at     TIMESTAMPTZ NOT NULL,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT notification_log_meeting_reminder_fire_uniq
        UNIQUE (meeting_id, reminder_minutes, fire_at)
    )
  `);

  // Add calendar_token to meetings (multi-tenant support)
  await db.execute(sql`
    ALTER TABLE meetings
      ADD COLUMN IF NOT EXISTS calendar_token TEXT NOT NULL DEFAULT 'admin/ark/felixdgreat'
  `);

  // Add calendar_token to push_subscriptions
  await db.execute(sql`
    ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS calendar_token TEXT NOT NULL DEFAULT 'admin/ark/felixdgreat'
  `);
}

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Schema initialization failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
