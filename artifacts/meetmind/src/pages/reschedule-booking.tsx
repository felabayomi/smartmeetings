import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { CalendarCheck2, CheckCircle2, Clock, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { readGuestBookings, rememberGuestBooking } from "@/lib/booking-calendar";

type Profile = { displayName:string; timezone:string; durationMinutes:number };
type Slot = { startTime:string; endTime:string };
type Booking = { guestName:string; startTime:string; endTime:string };
function zone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}
function format(iso:string,timeZone:string,options?:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat(undefined,options||{dateStyle:"medium",timeStyle:"short",timeZone}).format(new Date(iso))}

export default function RescheduleBooking(){
  const {token}=useParams<{token:string}>();
  const visitorZone=useMemo(zone,[]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [booking,setBooking]=useState<Booking|null>(null);
  const [slots,setSlots]=useState<Slot[]>([]);
  const [selected,setSelected]=useState<Slot|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{fetch(`/api/booking-management/${encodeURIComponent(token)}/slots`).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setProfile(data.profile);setBooking(data.booking);setSlots(data.slots)}).catch(error=>setError(error.message)).finally(()=>setLoading(false))},[token]);
  const grouped=slots.reduce<Record<string,Slot[]>>((acc,slot)=>{const key=format(slot.startTime,visitorZone,{weekday:"long",month:"short",day:"numeric",timeZone:visitorZone});(acc[key]??=[]).push(slot);return acc},{});
  async function reschedule(){if(!selected)return;setSaving(true);setError("");try{const response=await fetch(`/api/booking-management/${encodeURIComponent(token)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startTime:selected.startTime})});const data=await response.json();if(!response.ok)throw new Error(data.error);setBooking(data.booking);const saved=readGuestBookings().find(item=>item.manageToken===token);if(saved&&profile)rememberGuestBooking({...saved,hostName:profile.displayName,startTime:selected.startTime,endTime:selected.endTime,ownerTimezone:profile.timezone});setDone(true)}catch(error){setError(error instanceof Error?error.message:"Could not reschedule")}finally{setSaving(false)}}
  if(loading)return <div className="min-h-screen grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary"/></div>;
  if(error&&!profile)return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-bold">Rescheduling unavailable</h1><p className="text-muted-foreground mt-2">{error}</p></div></div>;
  if(done&&selected&&profile)return <div className="min-h-screen bg-[#f8f9ff] flex flex-col"><main className="flex-1 grid place-items-center p-5"><div className="bg-white border shadow-xl rounded-3xl max-w-xl w-full p-8 text-center"><CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto"/><h1 className="text-3xl font-bold mt-5">Meeting rescheduled</h1><p className="text-muted-foreground mt-2">Your previous time has been released for others to book.</p><div className="rounded-2xl bg-slate-50 p-5 mt-6"><p className="font-bold">{format(selected.startTime,visitorZone)}</p><p className="text-sm text-muted-foreground mt-1">{visitorZone}</p><p className="text-sm text-muted-foreground">{format(selected.startTime,profile.timezone)} ({profile.timezone})</p></div></div></main><SiteFooter/></div>;
  return <div className="min-h-screen bg-[#f8f9ff] flex flex-col"><header className="max-w-6xl w-full mx-auto px-5 py-5"><a href="/"><img src="/logo-transparent.png" className="w-40" alt="MeetMind"/></a></header><main className="flex-1 max-w-6xl w-full mx-auto px-5 pb-16 grid lg:grid-cols-[340px_1fr] gap-6"><aside className="bg-slate-950 text-white rounded-3xl p-7 h-fit"><CalendarCheck2 className="w-12 h-12 text-teal-300"/><p className="text-slate-400 mt-7 text-sm">Reschedule your meeting with</p><h1 className="text-3xl font-bold mt-1">{profile?.displayName}</h1><div className="space-y-3 mt-7 text-slate-300"><p className="flex gap-3"><Clock className="w-5 h-5 text-teal-300"/>Currently: {booking&&format(booking.startTime,visitorZone)}</p><p className="flex gap-3"><Globe2 className="w-5 h-5 text-teal-300"/>Times shown in {visitorZone}</p></div></aside><section className="bg-white border rounded-3xl p-5 sm:p-7 shadow-sm"><h2 className="text-2xl font-bold">Choose a new time</h2><p className="text-muted-foreground mt-1">Your old time remains reserved until you confirm a replacement.</p>{selected?<div className="mt-7 space-y-5"><Button variant="ghost" onClick={()=>setSelected(null)}>← Choose another time</Button><div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><p className="font-bold text-lg">{format(selected.startTime,visitorZone)}</p><p className="text-sm text-muted-foreground mt-1">{format(selected.startTime,profile!.timezone)} in {profile!.timezone}</p></div>{error&&<p className="text-destructive text-sm">{error}</p>}<Button size="lg" onClick={reschedule} disabled={saving} className="rounded-xl w-full sm:w-auto">{saving&&<Loader2 className="animate-spin w-4 h-4 mr-2"/>}Confirm new time</Button></div>:<div className="mt-7 space-y-7">{Object.keys(grouped).length?Object.entries(grouped).map(([day,items])=><div key={day}><h3 className="font-bold mb-3">{day}</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{items.map(slot=><Button key={slot.startTime} variant="outline" onClick={()=>setSelected(slot)} className="rounded-xl h-11 text-primary border-primary/20">{format(slot.startTime,visitorZone,{hour:"numeric",minute:"2-digit",timeZone:visitorZone})}</Button>)}</div></div>):<div className="py-16 text-center text-muted-foreground">No other open times in the next 30 days.</div>}</div>}</section></main><SiteFooter/></div>
}
