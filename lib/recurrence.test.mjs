import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInTimeZone } from 'date-fns-tz';
import { normalizeRecurrence, expandRecurrence } from './recurrence.mjs';
import { createSeries, excludeOccurrence, materializeSeries } from './recurrence-store.mjs';
const template = {startTime:'2026-09-08T20:00:00Z',endTime:'2026-09-08T21:00:00Z'};
const rule = (overrides={}) => normalizeRecurrence({frequency:'weekly',interval:2,timezone:'America/New_York',weekdays:[2],count:null,until:null,...overrides},template.startTime);
test('biweekly Tuesday keeps 4pm Eastern after DST, with exact count',()=>{
  const rows=expandRecurrence(template,rule({count:6}),new Date('2027-01-01'));
  assert.equal(rows.length,6);
  assert.equal(rows[0].startTime,'2026-09-08T20:00:00.000Z');
  assert.equal(rows[5].startTime,'2026-11-17T21:00:00.000Z');
  for(const row of rows) assert.equal(formatInTimeZone(row.startTime,'America/New_York','EEE HH:mm'),'Tue 16:00');
});
test('end date is inclusive in source timezone',()=>{
  const rows=expandRecurrence(template,rule({until:'2026-10-06'}),new Date('2027-01-01'));
  assert.equal(rows.length,3);
  assert.equal(rows.at(-1).key,'2026-10-06T16:00:00');
});
test('multiple weekdays stay in alternate Monday-based weeks',()=>{
  const rows=expandRecurrence(template,rule({weekdays:[2,4],count:4}),new Date('2027-01-01'));
  assert.deepEqual(rows.map(r=>r.key.slice(0,10)),['2026-09-08','2026-09-10','2026-09-22','2026-09-24']);
});
test('Perth date converts to previous Eastern date without shifting source time',()=>{
  const t={startTime:'2026-08-21T01:00:00Z',endTime:'2026-08-21T02:00:00Z'};
  const r=normalizeRecurrence({frequency:'weekly',interval:1,timezone:'Australia/Perth',weekdays:[5],count:2},t.startTime);
  const rows=expandRecurrence(t,r,new Date('2026-10-01'));
  assert.equal(formatInTimeZone(rows[0].startTime,'America/New_York','yyyy-MM-dd HH:mm'),'2026-08-20 21:00');
  assert.equal(formatInTimeZone(rows[1].startTime,'Australia/Perth','yyyy-MM-dd HH:mm'),'2026-08-28 09:00');
});
test('monthly 31st skips missing days without drifting',()=>{
  const t={startTime:'2026-01-31T12:00:00Z'};
  const r=normalizeRecurrence({frequency:'monthly',interval:1,timezone:'UTC',count:3},t.startTime);
  assert.deepEqual(expandRecurrence(t,r,new Date('2026-07-01')).map(x=>x.key.slice(0,10)),['2026-01-31','2026-03-31','2026-05-31']);
});
test('yearly leap-day recurrence skips non-leap years',()=>{
  const t={startTime:'2024-02-29T12:00:00Z'};
  const r=normalizeRecurrence({frequency:'yearly',interval:1,timezone:'UTC',count:2},t.startTime);
  assert.deepEqual(expandRecurrence(t,r,new Date('2029-01-01')).map(x=>x.key.slice(0,10)),['2024-02-29','2028-02-29']);
});
test('spring-forward nonexistent time is skipped',()=>{
  const t={startTime:'2026-03-07T07:30:00Z'};
  const r=normalizeRecurrence({frequency:'daily',interval:1,timezone:'America/New_York',count:2},t.startTime);
  assert.deepEqual(expandRecurrence(t,r,new Date('2026-03-12')).map(x=>x.key.slice(0,10)),['2026-03-07','2026-03-09']);
});
test('invalid intervals, zones, end dates and counts are rejected',()=>{
  for(const change of [{interval:0},{interval:1.5},{count:0},{timezone:'EST-bogus'},{until:'2026-02-30'},{until:'2025-01-01'},{count:3,until:'2027-01-01'}]) assert.throws(()=>rule(change));
});
test('rolling expansion keeps earlier keys stable',()=>{
  const early=expandRecurrence(template,rule(),new Date('2027-01-01'));
  const late=expandRecurrence(template,rule(),new Date('2028-01-01'));
  assert.deepEqual(late.slice(0,early.length),early);
});

test('creating a series binds owner, preserves reminders/scan, and uses idempotent inserts',async()=>{
  const calls=[];
  const client={query:async(sql,params)=>{calls.push({sql,params});return {rows:sql.startsWith('INSERT INTO meetings')?[{id:1}]:[]};}};
  await createSeries(client,'owner-A',{...template,title:'Team',reminderMinutes:10080,sourceScanId:'private-scan'},rule({count:2}));
  const insert=calls.find(c=>c.sql.startsWith('INSERT INTO meetings'));
  assert.equal(insert.params[0],'owner-A');
  assert.match(insert.sql,/ON CONFLICT \(series_id,recurrence_key\) DO NOTHING/);
  assert.ok(insert.params.includes(10080));
  assert.ok(insert.params.includes('private-scan'));
  assert.equal(JSON.parse(insert.params.at(-1)).length,2);
});
test('deleting one occurrence records a durable exclusion',async()=>{
  let args;
  await excludeOccurrence({query:async(...values)=>{args=values;}},{series_id:'series',recurrence_key:'2026-09-08T16:00:00'});
  assert.equal(args[1][0],'series');
  assert.deepEqual(JSON.parse(args[1][1]),['2026-09-08T16:00:00']);
});
test('rolling storage excludes deleted occurrences, respects stopped future, and scopes owner',async()=>{
  const calls=[];
  const series={id:'series',owner_id:'owner-A',template:{...template,title:'Team'},rule:rule(),active:true,excluded_keys:['2026-09-08T16:00:00'],stop_before:'2026-10-06T16:00:00'};
  const client={release:()=>{},query:async(sql,params)=>{calls.push({sql,params});return {rows:sql.startsWith('SELECT * FROM meeting_series')?[series]:[]};}};
  const pool={query:async()=>({rows:[]}),connect:async()=>client};
  await materializeSeries(pool,'owner-A');
  const select=calls.find(c=>c.sql.startsWith('SELECT * FROM meeting_series'));
  assert.equal(select.params[0],'owner-A');
  assert.match(select.sql,/FOR UPDATE/);
  const insert=calls.find(c=>c.sql.startsWith('INSERT INTO meetings'));
  assert.deepEqual(JSON.parse(insert.params.at(-1)).map(x=>x.key),['2026-09-22T16:00:00']);
  assert.equal(calls.at(-1).sql,'COMMIT');
});
