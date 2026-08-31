import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export class RecurrenceError extends Error {}
const DAY = 86400000;
export function normalizeRecurrence(input, startTime) {
  if (input == null) return null;
  const fail = message => { throw new RecurrenceError(message); };
  const { frequency, timezone, until = null, count = null } = input;
  if (!['daily','weekly','monthly','yearly'].includes(frequency)) fail('Invalid repeat frequency.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { fail('Invalid recurrence timezone.'); }
  if (!timezone || !Number.isFinite(new Date(startTime).getTime())) fail('Start time and recurrence timezone are required.');
  const interval = Number(input.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) fail('Repeat interval must be 1–365.');
  if (count !== null && (!Number.isInteger(count) || count < 1 || count > 1000)) fail('Occurrence count must be 1–1000.');
  if (until !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(until) || !Number.isFinite(Date.parse(until)) || new Date(until).toISOString().slice(0,10) !== until)) fail('Invalid recurrence end date.');
  if (until && until < formatInTimeZone(startTime, timezone, 'yyyy-MM-dd')) fail('End date precedes the first meeting.');
  if (until && count !== null) fail('Choose either an end date or a count.');
  const weekdays = frequency === 'weekly' ? [...new Set(input.weekdays || [])].sort() : [];
  if (weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) fail('Invalid weekday.');
  if (frequency === 'weekly' && !weekdays.length) weekdays.push(Number(formatInTimeZone(startTime, timezone, 'i')) % 7);
  return { frequency, interval, timezone, weekdays, count, until };
}

// Iterate local calendar dates, not UTC durations. Skip impossible month dates
// and nonexistent DST wall times rather than silently moving the appointment.
export function expandRecurrence(template, rule, horizon) {
  const local = formatInTimeZone(template.startTime, rule.timezone, "yyyy-MM-dd'T'HH:mm:ss");
  const anchor = new Date(local + 'Z');
  const baseDay = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const baseWeek = baseDay - ((anchor.getUTCDay()+6)%7)*DAY;
  const stopDay = Date.parse(formatInTimeZone(horizon, rule.timezone, 'yyyy-MM-dd')+'T00:00:00Z');
  const duration = template.endTime ? new Date(template.endTime)-new Date(template.startTime) : null;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) throw new RecurrenceError('End time must follow start time.');
  const output = [];
  let ordinal = 0;
  for (let day=baseDay; day<=stopDay; day+=DAY) {
    const date = new Date(day), key = date.toISOString().slice(0,10);
    if (rule.until && key > rule.until) break;
    const months = (date.getUTCFullYear()-anchor.getUTCFullYear())*12+date.getUTCMonth()-anchor.getUTCMonth();
    const matches = rule.frequency === 'daily' ? ((day-baseDay)/DAY)%rule.interval===0
      : rule.frequency === 'weekly' ? Math.floor((day-baseWeek)/DAY/7)%rule.interval===0 && rule.weekdays.includes(date.getUTCDay())
      : rule.frequency === 'monthly' ? months%rule.interval===0 && date.getUTCDate()===anchor.getUTCDate()
      : (date.getUTCFullYear()-anchor.getUTCFullYear())%rule.interval===0 && date.getUTCMonth()===anchor.getUTCMonth() && date.getUTCDate()===anchor.getUTCDate();
    if (!matches) continue;
    const wall = key+local.slice(10);
    // Preserve the explicitly chosen instant for the first occurrence when
    // fall-back creates two instants with the same local clock reading.
    const start = wall === local ? new Date(template.startTime) : fromZonedTime(wall,rule.timezone);
    if (formatInTimeZone(start,rule.timezone,"yyyy-MM-dd'T'HH:mm:ss") !== wall) continue;
    if (rule.count !== null && ordinal >= rule.count) break;
    output.push({key:wall,ordinal:++ordinal,startTime:start.toISOString(),endTime:duration===null?null:new Date(+start+duration).toISOString()});
  }
  return output;
}
