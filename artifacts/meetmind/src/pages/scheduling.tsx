import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { fromZonedTime } from "date-fns-tz";
import { Ban, CalendarClock, Check, Clipboard, ExternalLink, Link2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Window = { day: number; enabled: boolean; allDay?: boolean; start: string; end: string };
type Blackout = { id: string; date: string; allDay: boolean; start: string; end: string };
type Profile = { slug: string; displayName: string; timezone: string; durationMinutes: number; bufferMinutes: number; availability: Window[]; maxBookingsPerDay: number | null; blackouts: Blackout[] };
type Poll = { id: string; slug: string; title: string; timezone: string; options: string[]; status: string; counts: Record<string, number>; responseCount: number; finalStart?: string };
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const defaults: Window[] = [1,2,3,4,5,6,0].map(day => ({ day, enabled: day > 0 && day < 6, allDay:false, start: "09:00", end: "17:00" }));

function browserTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; }
function displayDate(iso: string, timezone: string) { return new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short", timeZone: timezone }).format(new Date(iso)); }
function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }

export default function Scheduling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey:["scheduling-profile"], queryFn:() => customFetch<Profile | null>("/api/scheduling/profile", { responseType:"json" }) });
  const pollsQuery = useQuery({ queryKey:["scheduling-polls"], queryFn:() => customFetch<Poll[]>("/api/scheduling/polls", { responseType:"json" }) });
  const existing = profileQuery.data;
  const [displayName, setDisplayName] = useState("");
  const [bookingSlug, setBookingSlug] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [availability, setAvailability] = useState<Window[]>(defaults);
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState<number | null>(null);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [blackoutDate, setBlackoutDate] = useState(localDate());
  const [blackoutAllDay, setBlackoutAllDay] = useState(false);
  const [blackoutStart, setBlackoutStart] = useState("09:00");
  const [blackoutEnd, setBlackoutEnd] = useState("17:00");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (existing && !hydrated) {
      setDisplayName(existing.displayName); setBookingSlug(existing.slug); setTimezone(existing.timezone); setDuration(existing.durationMinutes); setBuffer(existing.bufferMinutes); setAvailability(existing.availability.map(item=>({...item,allDay:Boolean(item.allDay)}))); setMaxBookingsPerDay(existing.maxBookingsPerDay ?? null); setBlackouts(existing.blackouts || []); setHydrated(true);
    }
  }, [existing, hydrated]);

  const saveProfile = useMutation({
    mutationFn:() => customFetch<Profile>("/api/scheduling/profile", { method:"PUT", responseType:"json", body:JSON.stringify({ displayName, slug:bookingSlug, timezone, durationMinutes:duration, bufferMinutes:buffer, availability, maxBookingsPerDay, blackouts }) }),
    onSuccess:(data) => { setBookingSlug(data.slug); setBuffer(data.bufferMinutes); queryClient.setQueryData(["scheduling-profile"], data); toast({title:"Booking page saved",description:`Your availability is live with a ${data.bufferMinutes}-minute buffer around calendar events.`}); },
    onError:(error:Error) => toast({variant:"destructive",title:"Could not save",description:error.message}),
  });

  const bookingUrl = existing ? `${window.location.origin}/book/${existing.slug}` : "";
  const updateWindow = (day:number, patch:Partial<Window>) => setAvailability(items => items.map(item => item.day === day ? {...item,...patch} : item));
  const addBlackout = () => {
    if (!blackoutDate || (!blackoutAllDay && blackoutStart >= blackoutEnd)) {
      toast({ variant:"destructive", title:"Check the blocked time", description:"Choose a date and make sure the end is after the start." });
      return;
    }
    setBlackouts(items => [...items, { id: crypto.randomUUID(), date:blackoutDate, allDay:blackoutAllDay, start:blackoutAllDay?"00:00":blackoutStart, end:blackoutAllDay?"24:00":blackoutEnd }].sort((a,b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)));
  };

  const [pollTitle,setPollTitle] = useState("");
  const [pollDescription,setPollDescription] = useState("");
  const [pollOptions,setPollOptions] = useState(["", "", ""]);
  const createPoll = useMutation({
    mutationFn:() => customFetch<Poll>("/api/scheduling/polls", {method:"POST",responseType:"json",body:JSON.stringify({title:pollTitle,description:pollDescription,timezone,durationMinutes:duration,options:pollOptions.filter(Boolean).map(value => fromZonedTime(value, timezone).toISOString())})}),
    onSuccess:() => { setPollTitle(""); setPollDescription(""); setPollOptions(["","",""]); queryClient.invalidateQueries({queryKey:["scheduling-polls"]}); toast({title:"Group poll created"}); },
    onError:(error:Error) => toast({variant:"destructive",title:"Could not create poll",description:error.message}),
  });
  const finalizePoll = useMutation({
    mutationFn:({id,startTime}:{id:string;startTime:string}) => customFetch(`/api/scheduling/polls/${id}/finalize`, {method:"POST",responseType:"json",body:JSON.stringify({startTime})}),
    onSuccess:() => { queryClient.invalidateQueries({queryKey:["scheduling-polls"]}); queryClient.invalidateQueries({queryKey:["/api/meetings"]}); toast({title:"Meeting confirmed",description:"It is now on your calendar."}); },
  });

  return <Layout><div className="space-y-10 pb-20">
    <div><div className="flex items-center gap-3"><CalendarClock className="w-8 h-8 text-primary"/><h1 className="text-4xl font-display font-bold">Scheduling</h1></div><p className="text-muted-foreground text-lg mt-2">Share availability for instant booking or find a group consensus.</p></div>

    <section className="glass-card rounded-3xl p-6 md:p-8 space-y-7">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">Your booking page</h2><p className="text-muted-foreground">Only open times are public. Calendar details stay private.</p></div><Button size="lg" onClick={()=>saveProfile.mutate()} disabled={saveProfile.isPending||!displayName} className="rounded-xl md:flex-shrink-0">{saveProfile.isPending?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<Check className="w-4 h-4 mr-2"/>}{bookingUrl?"Save changes":"Save and create share link"}</Button></div>
      {profileQuery.isLoading ? <div className="h-20 rounded-2xl bg-muted/40 animate-pulse" /> : bookingUrl ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5"><p className="text-sm font-bold text-emerald-800">Your public booking link is live</p><div className="mt-3 flex flex-col sm:flex-row gap-2"><Input readOnly value={bookingUrl} className="bg-white font-medium"/><Button variant="outline" className="bg-white" onClick={() => {navigator.clipboard.writeText(bookingUrl);toast({title:"Booking link copied"})}}><Clipboard className="w-4 h-4 mr-2"/>Copy link</Button><a href={bookingUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full bg-white"><ExternalLink className="w-4 h-4 mr-2"/>Preview</Button></a></div></div> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="font-bold text-amber-900">Publish once to create your share link</p><p className="text-sm text-amber-800 mt-1">Set your hours below, then use the button to make your booking page live.</p></div><Button onClick={()=>saveProfile.mutate()} disabled={saveProfile.isPending||!displayName} className="rounded-xl flex-shrink-0">Save and get link</Button></div>}
      <div className="grid md:grid-cols-2 gap-5">
        <label className="space-y-2"><span className="text-sm font-semibold">Name shown to bookers</span><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Felix"/></label>
        <label className="space-y-2"><span className="text-sm font-semibold">Booking link name</span><div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring"><span className="whitespace-nowrap pl-3 text-sm text-muted-foreground">/book/</span><Input value={bookingSlug} onChange={e=>setBookingSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-"))} placeholder="felix-abayomi" className="border-0 shadow-none focus-visible:ring-0"/></div><span className="block text-xs text-muted-foreground">You may change this independently of your display name. Previously shared links will redirect here.</span></label>
        <label className="space-y-2"><span className="text-sm font-semibold">Owner timezone</span><Input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="America/New_York"/></label>
        <label className="space-y-2"><span className="text-sm font-semibold">Meeting length (minutes)</span><Input type="number" min={15} max={180} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>
        <label className="space-y-2"><span className="text-sm font-semibold">Buffer around calendar events (minutes)</span><Input type="number" min={0} max={720} step={5} value={buffer} onChange={e=>setBuffer(Number(e.target.value))}/><span className="block text-xs text-muted-foreground">Blocks public booking times before and after every calendar event. Maximum 720 minutes.</span></label>
        <label className="space-y-2"><span className="text-sm font-semibold">Maximum direct bookings per day</span><select value={maxBookingsPerDay ?? "unlimited"} onChange={e=>setMaxBookingsPerDay(e.target.value==="unlimited"?null:Number(e.target.value))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="unlimited">Unlimited — use available hours</option>{[1,2,3,4,5].map(count=><option key={count} value={count}>{count} booking{count===1?"":"s"} per day</option>)}</select><span className="block text-xs text-muted-foreground">Once reached, all remaining public times for that day close.</span></label>
      </div>
      <div className="space-y-3"><div><h3 className="font-bold">Weekly availability</h3><p className="text-sm text-muted-foreground">Each day can be closed, use custom hours, or remain available for the full 24 hours.</p></div>{availability.map(item=><div key={item.day} className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-[130px_100px_110px_1fr_1fr] sm:items-center"><span className="font-medium">{dayNames[item.day]}</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={e=>updateWindow(item.day,{enabled:e.target.checked})}/>{item.enabled?"Available":"Closed"}</label>{item.enabled&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item.allDay)} onChange={e=>updateWindow(item.day,{allDay:e.target.checked,start:e.target.checked?"00:00":item.start==="00:00"?"09:00":item.start,end:e.target.checked?"24:00":item.end==="24:00"?"17:00":item.end})}/>24 hours</label>{!item.allDay&&<><Input type="time" aria-label={`${dayNames[item.day]} start time`} value={item.start} onChange={e=>updateWindow(item.day,{start:e.target.value})}/><Input type="time" aria-label={`${dayNames[item.day]} end time`} value={item.end} onChange={e=>updateWindow(item.day,{end:e.target.value})}/></>}</>}</div>)}</div>
      <div className="space-y-4 rounded-2xl border p-4 sm:p-5">
        <div className="flex items-start gap-3"><Ban className="mt-0.5 h-5 w-5 text-primary"/><div><h3 className="font-bold">Block specific dates and times</h3><p className="text-sm text-muted-foreground">Add as many separate blocked periods as you need on the same date—for example 9:00–11:00 and 2:00–4:00—or block the entire day.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-[1.2fr_auto_1fr_1fr_auto] sm:items-end">
          <label className="space-y-2"><span className="text-sm font-semibold">Date</span><Input type="date" value={blackoutDate} onChange={e=>setBlackoutDate(e.target.value)}/></label>
          <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={blackoutAllDay} onChange={e=>setBlackoutAllDay(e.target.checked)}/>All day</label>
          {!blackoutAllDay&&<><label className="space-y-2"><span className="text-sm font-semibold">From</span><Input type="time" value={blackoutStart} onChange={e=>setBlackoutStart(e.target.value)}/></label><label className="space-y-2"><span className="text-sm font-semibold">Until</span><Input type="time" value={blackoutEnd} onChange={e=>setBlackoutEnd(e.target.value)}/></label></>}
          <Button type="button" variant="outline" onClick={addBlackout}><Plus className="mr-2 h-4 w-4"/>Block</Button>
        </div>
        {blackouts.length?<div className="space-y-2">{blackouts.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"><p className="text-sm"><strong>{new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(`${item.date}T12:00:00Z`))}</strong><span className="text-muted-foreground"> · {item.allDay?"All day":`${item.start}–${item.end}`} ({timezone})</span></p><Button type="button" size="icon" variant="ghost" aria-label="Remove blocked time" onClick={()=>setBlackouts(items=>items.filter(block=>block.id!==item.id))}><Trash2 className="h-4 w-4"/></Button></div>)}</div>:<p className="text-sm text-muted-foreground">No dates or times are currently blocked.</p>}
      </div>
    </section>

    <section className="glass-card rounded-3xl p-6 md:p-8 space-y-7">
      <div><div className="flex items-center gap-2"><Users className="w-6 h-6 text-primary"/><h2 className="text-2xl font-bold">Create a group poll</h2></div><p className="text-muted-foreground mt-1">Propose times, collect votes, then confirm the best option onto your calendar.</p></div>
      <div className="grid md:grid-cols-2 gap-5"><label className="space-y-2"><span className="text-sm font-semibold">Meeting title</span><Input value={pollTitle} onChange={e=>setPollTitle(e.target.value)} placeholder="Quarterly planning"/></label><label className="space-y-2"><span className="text-sm font-semibold">Organizer timezone</span><Input value={timezone} onChange={e=>setTimezone(e.target.value)}/></label></div><Textarea value={pollDescription} onChange={e=>setPollDescription(e.target.value)} placeholder="Optional description"/>
      <div className="space-y-3">{pollOptions.map((value,index)=><div key={index} className="flex gap-2"><Input type="datetime-local" value={value} onChange={e=>setPollOptions(items=>items.map((item,i)=>i===index?e.target.value:item))}/>{pollOptions.length>2&&<Button variant="ghost" onClick={()=>setPollOptions(items=>items.filter((_,i)=>i!==index))}>Remove</Button>}</div>)}<Button variant="outline" onClick={()=>setPollOptions(items=>[...items,""])}><Plus className="w-4 h-4 mr-2"/>Add option</Button></div>
      <Button onClick={()=>createPoll.mutate()} disabled={createPoll.isPending||!pollTitle} className="rounded-xl"><Users className="w-4 h-4 mr-2"/>Create poll</Button>
    </section>

    <section className="space-y-4"><h2 className="text-2xl font-bold">Your group polls</h2>{pollsQuery.isLoading?<Loader2 className="animate-spin"/>:pollsQuery.data?.length?pollsQuery.data.map(poll=><div key={poll.id} className="glass-card rounded-2xl p-5"><div className="flex flex-col sm:flex-row justify-between gap-3"><div><h3 className="font-bold text-lg">{poll.title}</h3><p className="text-sm text-muted-foreground">{poll.responseCount} responses • {poll.status}</p></div><Button variant="outline" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/poll/${poll.slug}`);toast({title:"Poll link copied"})}}><Link2 className="w-4 h-4 mr-2"/>Copy poll link</Button></div><div className="mt-4 space-y-2">{poll.options.map(option=><div key={option} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-muted/50 p-3"><span>{displayDate(option,poll.timezone)} <strong className="ml-2">{poll.counts[option]||0} votes</strong></span>{poll.status==="open"&&<Button size="sm" onClick={()=>finalizePoll.mutate({id:poll.id,startTime:option})}>Confirm this time</Button>}</div>)}</div></div>):<p className="text-muted-foreground">No polls yet.</p>}</section>
  </div></Layout>;
}
