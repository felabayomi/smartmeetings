const { fromZonedTime, formatInTimeZone } = require('date-fns-tz');
class IcsError extends Error {}
const fail = message => { throw new IcsError(message); };
function property(line) {
  let quoted=false, colon=-1;
  for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;if(line[i]===':'&&!quoted){colon=i;break;}}
  if(colon<1) fail('Invalid calendar content line.');
  const parts=line.slice(0,colon).match(/(?:[^;\"]|\"[^\"]*\")+/g)||[];
  const params={};
  for(const part of parts.slice(1)){const at=part.indexOf('=');if(at>0)params[part.slice(0,at).toUpperCase()]=part.slice(at+1).replace(/^"|"$/g,'');}
  return {name:parts[0].toUpperCase(),params,value:line.slice(colon+1)};
}
const text = value => (value||'').replace(/\\([nN,;\\])/g,(_,c)=>/[nN]/.test(c)?'\n':c);
const prop = (node,name) => node.props.find(p=>p.name===name);
function timestamp(p, fallback) {
  if(!p) fail('Missing start date.');
  if(p.params.VALUE==='DATE'||/^\d{8}$/.test(p.value)) fail('All-day entries are not supported by this timed-meeting importer yet.');
  const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(p.value);
  if(!m) fail('Unsupported date format.');
  const wall=`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  if(!Number.isFinite(Date.parse(wall+'Z'))||new Date(wall+'Z').toISOString().slice(0,19)!==wall) fail('Invalid calendar date or time.');
  const zone=m[7]?'UTC':p.params.TZID||fallback;
  try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); } catch { fail(`Unsupported timezone: ${zone}`); }
  const date=m[7]?new Date(wall+'Z'):fromZonedTime(wall,zone);
  if(formatInTimeZone(date,zone,"yyyy-MM-dd'T'HH:mm:ss")!==wall) fail('The local time does not exist during a daylight-saving change.');
  return {iso:date.toISOString(),zone,floating:!m[7]&&!p.params.TZID};
}
function alarmMinutes(alarm) {
  if(prop(alarm,'ACTION')?.value!=='DISPLAY') fail('Only display reminders are supported.');
  if(prop(alarm,'REPEAT')||prop(alarm,'DURATION')) fail('Repeating alarms are not supported.');
  const trigger=prop(alarm,'TRIGGER');
  if(!trigger || (trigger.params.RELATED && trigger.params.RELATED!=='START')) fail('Only reminders relative to the event start are supported.');
  const m=/^(-)?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(trigger.value);
  if(!m || !m.slice(2).some(v=>v!==undefined)) fail('Unsupported reminder trigger.');
  const seconds=Number(m[2]||0)*604800+Number(m[3]||0)*86400+Number(m[4]||0)*3600+Number(m[5]||0)*60+Number(m[6]||0);
  if((!m[1]&&seconds>0)||seconds%60||seconds>604800) fail('Reminders must be whole minutes, from event time to 7 days before.');
  return seconds/60;
}
function parseIcs(source, timezone) {
  if(typeof source!=='string'||Buffer.byteLength(source,'utf8')>524288) fail('Choose an ICS file smaller than 512 KB.');
  if(!timezone) fail('Confirm the timezone for local event times.');
  try {new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{fail('Choose a valid IANA timezone.');}
  const lines=source.replace(/^\uFEFF/,'').replace(/\r?\n[ \t]/g,'').split(/\r?\n/).filter(Boolean);
  const stack=[], roots=[];
  for(const line of lines){
    const p=property(line);
    if(p.name==='BEGIN') {const n={type:p.value,props:[],children:[]};if(stack.length)stack.at(-1).children.push(n);else roots.push(n);stack.push(n);if(stack.length>10)fail('Calendar nesting is too deep.');}
    else if(p.name==='END'){if(stack.pop()?.type!==p.value)fail('Unbalanced calendar components.');}
    else {if(!stack.length)fail('Content outside calendar.');stack.at(-1).props.push(p);}
  }
  if(stack.length||roots.length!==1||roots[0].type!=='VCALENDAR')fail('Not a complete ICS calendar.');
  const calendar=roots[0];
  if(prop(calendar,'METHOD')?.value==='CANCEL')fail('Cancellation files cannot be imported as new meetings.');
  const nodes=calendar.children.filter(n=>n.type==='VEVENT');
  if(!nodes.length||nodes.length>200)fail('Import between 1 and 200 events at a time.');
  const events=[], warnings=[], seen=new Set();
  const exceptionUids=new Set(nodes.filter(n=>prop(n,'RECURRENCE-ID')).map(n=>prop(n,'UID')?.value));
  for(const node of nodes){
    const title=text(prop(node,'SUMMARY')?.value)||'Untitled event';
    try {
      const uid=prop(node,'UID')?.value;
      if(!uid||uid.length>1024)fail('A valid event UID is required for duplicate prevention.');
      if(['RRULE','RDATE','EXDATE','RECURRENCE-ID'].some(key=>prop(node,key))||exceptionUids.has(uid))fail('Recurring ICS entries and exceptions are not supported yet; create this series using Repeat meeting instead.');
      if(prop(node,'STATUS')?.value==='CANCELLED')fail('Cancelled event skipped.');
      if(seen.has(uid))fail('Duplicate event UID inside this file.');
      if(node.props.filter(p=>p.name==='DTSTART').length!==1)fail('Exactly one start time is required.');
      const start=timestamp(prop(node,'DTSTART'),timezone);
      if(prop(node,'DURATION'))fail('Duration-based events are not supported yet; export with an end time.');
      const end=prop(node,'DTEND')?timestamp(prop(node,'DTEND'),timezone):{iso:new Date(Date.parse(start.iso)+1800000).toISOString()};
      if(end.iso<=start.iso)fail('End time must follow start time.');
      const alarms=node.children.filter(n=>n.type==='VALARM');
      const reminders=alarms.length?[...new Set(alarms.map(alarmMinutes))]:[15];
      if(reminders.length>4)fail('More than four reminders: review this event separately.');
      const notices=[];
      if(!prop(node,'DTEND'))notices.push('No end time: 30-minute duration applied.');
      if(!alarms.length)notices.push('No file alerts: default 15-minute reminder applied.');
      if(reminders.some(minutes=>Date.parse(start.iso)-minutes*60000<Date.now()))notices.push('Past reminder times will not be replayed.');
      seen.add(uid);
      events.push({uid,title,description:text(prop(node,'DESCRIPTION')?.value),location:text(prop(node,'LOCATION')?.value),startTime:start.iso,endTime:end.iso,timezone:start.zone,floating:start.floating,reminders,notices});
    }catch(error){warnings.push(`${title}: ${error.message}`);}
  }
  return {name:text(prop(calendar,'X-WR-CALNAME')?.value)||'Calendar import',timezone,events,warnings};
}
exports.IcsError=IcsError;
exports.parseIcs=parseIcs;
