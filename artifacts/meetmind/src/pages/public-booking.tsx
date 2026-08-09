import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { ArrowRight, CalendarCheck2, CheckCircle2, Clock, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SiteFooter } from "@/components/site-footer";
import { InstallAppButton } from "@/components/install-app-button";

type Profile = { slug:string; displayName:string; timezone:string; durationMinutes:number; bufferMinutes:number };
type Slot = { startTime:string; endTime:string };
function zone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
function format(iso:string,timeZone:string,options?:Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat(undefined, options || {dateStyle:"medium",timeStyle:"short",timeZone}).format(new Date(iso)); }

export default function PublicBooking() {
  const { slug } = useParams<{slug:string}>();
  const visitorZone = useMemo(zone,[]);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [slots,setSlots] = useState<Slot[]>([]);
  const [selected,setSelected] = useState<Slot|null>(null);
  const [loading,setLoading] = useState(true);
  const [submitting,setSubmitting] = useState(false);
  const [done,setDone] = useState(false);
  const [error,setError] = useState("");
  const [name,setName] = useState(""); const [email,setEmail] = useState(""); const [notes,setNotes] = useState("");

  useEffect(()=>{ fetch(`/api/booking/${encodeURIComponent(slug)}/slots`).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(data.profile?.slug&&data.profile.slug!==slug){window.location.replace(`/book/${encodeURIComponent(data.profile.slug)}`);return}setProfile(data.profile);setSlots(data.slots)}).catch(error=>setError(error.message)).finally(()=>setLoading(false)); },[slug]);
  const grouped = slots.reduce<Record<string,Slot[]>>((acc,slot)=>{const key=format(slot.startTime,visitorZone,{weekday:"long",month:"short",day:"numeric",timeZone:visitorZone});(acc[key]??=[]).push(slot);return acc},{});

  async function book() { if(!selected)return;setSubmitting(true);setError("");try{const response=await fetch(`/api/booking/${encodeURIComponent(slug)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startTime:selected.startTime,guestName:name,guestEmail:email,guestTimezone:visitorZone,notes})});const data=await response.json();if(!response.ok)throw new Error(data.error);setDone(true)}catch(error){setError(error instanceof Error?error.message:"Could not book") }finally{setSubmitting(false)} }

  if(loading)return <div className="min-h-screen grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;
  if(error&&!profile)return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Booking page unavailable</h1><p className="text-muted-foreground mt-2">{error}</p></div></div>;
  if(done&&selected&&profile)return <div className="min-h-screen bg-[#f8f9ff] flex flex-col"><main className="flex-1 grid place-items-center p-5"><div className="bg-white rounded-3xl shadow-xl border max-w-xl w-full p-7 sm:p-9 text-center"><CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto"/><h1 className="text-3xl font-bold mt-5">You’re booked!</h1><p className="text-muted-foreground mt-2">Your meeting with {profile.displayName} is confirmed.</p><div className="rounded-2xl bg-slate-50 p-5 mt-6"><p className="font-bold">{format(selected.startTime,visitorZone)}</p><p className="text-sm text-muted-foreground mt-1">Your timezone: {visitorZone}</p><p className="text-sm text-muted-foreground">Owner timezone: {format(selected.startTime,profile.timezone)} ({profile.timezone})</p></div><div className="mt-7 rounded-2xl bg-slate-950 text-white p-6"><h2 className="text-xl font-bold">Make scheduling this easy for your meetings</h2><p className="mt-2 text-sm text-slate-300">Create a free MeetMind account to share your own booking page, run group polls, and organize your calendar.</p><div className="mt-5 flex flex-col sm:flex-row justify-center gap-2"><a href="/sign-up"><Button className="w-full sm:w-auto">Create free account <ArrowRight className="ml-2 w-4 h-4"/></Button></a><InstallAppButton className="w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"/></div></div></div></main><SiteFooter /></div>;

  return <div className="min-h-screen bg-[#f8f9ff]"><header className="max-w-6xl mx-auto px-5 py-5"><a href="/"><img src="/logo-transparent.png" className="w-40" alt="MeetMind"/></a></header><main className="max-w-6xl mx-auto px-5 pb-16 grid lg:grid-cols-[340px_1fr] gap-6">
    <aside className="bg-slate-950 text-white rounded-3xl p-7 h-fit lg:sticky lg:top-5"><div className="w-14 h-14 rounded-2xl bg-white/10 grid place-items-center"><CalendarCheck2 className="w-7 h-7 text-teal-300"/></div><p className="text-slate-400 mt-8 text-sm">Book a meeting with</p><h1 className="text-3xl font-bold mt-1">{profile?.displayName}</h1><div className="space-y-4 mt-8 text-slate-300"><p className="flex gap-3"><Clock className="w-5 h-5 text-teal-300"/>{profile?.durationMinutes} minutes</p><p className="flex gap-3"><Globe2 className="w-5 h-5 text-teal-300"/>Owner timezone<br/>{profile?.timezone}</p></div><div className="mt-8 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">Times are shown in <strong className="text-white">{visitorZone}</strong>, your detected timezone.</div></aside>
    <section className="bg-white border rounded-3xl p-5 sm:p-7 shadow-sm"><h2 className="text-2xl font-bold">Choose an available time</h2><p className="text-muted-foreground mt-1">Private calendar events are hidden; only bookable openings appear.</p>{selected?<div className="mt-7 space-y-5"><Button variant="ghost" onClick={()=>setSelected(null)}>← Choose another time</Button><div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><p className="font-bold text-lg">{format(selected.startTime,visitorZone)}</p><p className="text-sm text-muted-foreground mt-1">{format(selected.startTime,profile!.timezone)} in {profile!.timezone}</p></div><div className="grid sm:grid-cols-2 gap-4"><label className="space-y-2"><span className="text-sm font-semibold">Your name</span><Input value={name} onChange={e=>setName(e.target.value)} /></label><label className="space-y-2"><span className="text-sm font-semibold">Email</span><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label></div><label className="space-y-2 block"><span className="text-sm font-semibold">Anything the host should know?</span><Textarea value={notes} onChange={e=>setNotes(e.target.value)} /></label>{error&&<p className="text-destructive text-sm">{error}</p>}<Button size="lg" onClick={book} disabled={submitting||!name||!email} className="rounded-xl w-full sm:w-auto">{submitting?<Loader2 className="animate-spin w-4 h-4 mr-2"/>:null}Confirm booking</Button></div>:<div className="mt-7 space-y-7">{Object.keys(grouped).length?Object.entries(grouped).map(([day,items])=><div key={day}><h3 className="font-bold mb-3">{day}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{items.map(slot=><Button key={slot.startTime} variant="outline" onClick={()=>setSelected(slot)} className="rounded-xl h-11 text-primary border-primary/20">{format(slot.startTime,visitorZone,{hour:"numeric",minute:"2-digit",timeZone:visitorZone})}</Button>)}</div></div>):<div className="py-16 text-center text-muted-foreground">No open times in the next 30 days.</div>}</div>}</section>
  </main><SiteFooter /></div>;
}
