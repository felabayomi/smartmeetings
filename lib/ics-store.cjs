let ready;
function ensureImportTables(pool) {
  if(!ready) ready=pool.query(`
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reminder_minutes_4 INTEGER;
    CREATE TABLE IF NOT EXISTS calendar_imports (
      owner_id TEXT NOT NULL, uid TEXT NOT NULL, meeting_id INTEGER,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(owner_id,uid)
    );
  `).catch(error=>{ready=undefined;throw error;});
  return ready;
}
async function importEvents(pool,owner,events) {
  await ensureImportTables(pool);
  const client=await pool.connect();
  let imported=0, skipped=0;
  try {
    await client.query('BEGIN');
    for(const event of events){
      const claimed=await client.query('INSERT INTO calendar_imports (owner_id,uid) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING uid',[owner,event.uid]);
      if(!claimed.rowCount){skipped++;continue;}
      const r=event.reminders;
      const result=await client.query(`INSERT INTO meetings
        (calendar_token,title,description,location,start_time,end_time,timezone,reminder_minutes,reminder_minutes_2,reminder_minutes_3,reminder_minutes_4)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [owner,event.title,event.description,event.location,event.startTime,event.endTime,event.timezone,r[0]??null,r[1]??null,r[2]??null,r[3]??null]);
      await client.query('UPDATE calendar_imports SET meeting_id=$3 WHERE owner_id=$1 AND uid=$2',[owner,event.uid,result.rows[0].id]);
      imported++;
    }
    await client.query('COMMIT');
    return {imported,skipped};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
exports.ensureImportTables=ensureImportTables;
exports.importEvents=importEvents;
