import { randomUUID } from 'node:crypto';
import { expandRecurrence, normalizeRecurrence, RecurrenceError } from './recurrence.mjs';

const columns = {title:'title',description:'description',timezone:'timezone',location:'location',organizer:'organizer',meetingUrl:'meeting_url',notes:'notes',reminderMinutes:'reminder_minutes',reminderMinutes2:'reminder_minutes_2',reminderMinutes3:'reminder_minutes_3',color:'color',sourceScanId:'scan_source_id'};
let ready;
export function ensureRecurrenceTables(pool) {
  if (!ready) ready = pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_series (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, rule JSONB NOT NULL,
      template JSONB NOT NULL, excluded_keys JSONB NOT NULL DEFAULT '[]',
      stop_before TEXT, generated_through TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE INDEX IF NOT EXISTS meeting_series_owner ON meeting_series(owner_id);
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS series_id TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_key TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence JSONB;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scan_source_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS meetings_series_occurrence ON meetings(series_id,recurrence_key);
  `).catch(error => { ready = undefined; throw error; });
  return ready;
}

async function populate(client, series, horizon) {
  if (!series.active) return [];
  const excluded = new Set(series.excluded_keys || []);
  const rows = expandRecurrence(series.template, series.rule, horizon).filter(row => !excluded.has(row.key) && (!series.stop_before || row.key < series.stop_before));
  if (rows.length > 10000) throw new RecurrenceError('This series starts too far in the past. Choose a more recent first occurrence.');
  const keys = Object.keys(columns).filter(key => series.template[key] !== undefined);
  const values = [series.owner_id,series.id,JSON.stringify(series.rule),...keys.map(key=>series.template[key]),JSON.stringify(rows)];
  const result = await client.query(`INSERT INTO meetings (calendar_token,series_id,recurrence,${keys.map(key=>columns[key]).join(',')},start_time,end_time,recurrence_key)
    SELECT $1,$2,$3::jsonb,${keys.map((_,i)=>'$'+(i+4)).join(',')},item."startTime",item."endTime",item.key
    FROM jsonb_to_recordset($${values.length}::jsonb) AS item(key text,"startTime" timestamptz,"endTime" timestamptz)
    ON CONFLICT (series_id,recurrence_key) DO NOTHING RETURNING *`,values);
  await client.query('UPDATE meeting_series SET generated_through=$2 WHERE id=$1',[series.id,horizon]);
  return result.rows;
}

export async function createSeries(client, owner, template, rawRule) {
  const rule = normalizeRecurrence(rawRule,template.startTime);
  if (!rule) throw new RecurrenceError('A repeat rule is required.');
  const series = {id:randomUUID(),owner_id:owner,template,rule,active:true,excluded_keys:[]};
  await client.query('INSERT INTO meeting_series (id,owner_id,template,rule) VALUES ($1,$2,$3,$4)',[series.id,owner,JSON.stringify(template),JSON.stringify(rule)]);
  const horizon = new Date(Math.max(Date.now(),Date.parse(template.startTime))+550*86400000);
  const rows = await populate(client,series,horizon);
  if (!rows.length) throw new RecurrenceError('No occurrences match this rule. Check the start date and selected weekdays.');
  return rows[0];
}

// Called by calendar loading, public slot checks and reminder processing.
// The row lock + unique key also make concurrent refreshes idempotent.
export async function materializeSeries(pool, owner = null) {
  await ensureRecurrenceTables(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const horizon = new Date(Date.now()+550*86400000);
    const result = await client.query(`SELECT * FROM meeting_series WHERE active=TRUE AND ($1::text IS NULL OR owner_id=$1)
      AND (generated_through IS NULL OR generated_through < $2) ORDER BY id FOR UPDATE`,[owner,new Date(+horizon-86400000)]);
    for (const series of result.rows) await populate(client,series,horizon);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function excludeOccurrence(client, row) {
  if (row.series_id) await client.query(`UPDATE meeting_series SET excluded_keys=excluded_keys || $2::jsonb WHERE id=$1`,[row.series_id,JSON.stringify([row.recurrence_key])]);
}
