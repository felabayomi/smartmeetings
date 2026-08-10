import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { CalendarCheck2, Clock, Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { downloadCalendarFile, googleCalendarUrl, outlookCalendarUrl, readGuestBookings, type SavedGuestBooking } from "@/lib/booking-calendar";

type AccountBooking = SavedGuestBooking & { guestName?:string; guestEmail?:string };
function displayDate(iso:string){return new Intl.DateTimeFormat(undefined,{dateStyle:"full",timeStyle:"short"}).format(new Date(iso))}

export default function MyBookings(){
  const {getToken}=useAuth();
  const [remote,setRemote]=useState<AccountBooking[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const local=useMemo(()=>readGuestBookings(),[]);
  useEffect(()=>{let active=true;(async()=>{try{const token=await getToken();const response=await fetch("/api/guest-bookings",{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error);if(active)setRemote(data)}catch(error){if(active)setError(error instanceof Error?error.message:"Could not load bookings")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[getToken]);
  const bookings=useMemo(()=>{const byId=new Map<string,AccountBooking>();[...local,...remote].forEach(item=>byId.set(item.id,{...byId.get(item.id),...item}));return [...byId.values()].sort((a,b)=>new Date(a.startTime).getTime()-new Date(b.startTime).getTime())},[local,remote]);
  const upcoming=bookings.filter(item=>new Date(item.endTime)>new Date());
  const past=bookings.filter(item=>new Date(item.endTime)<=new Date());
  const card=(item:AccountBooking)=><article key={item.id} className="glass-card rounded-2xl p-5 border"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Meeting with</p><h2 className="text-xl font-bold">{item.hostName}</h2><p className="mt-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/>{displayDate(item.startTime)}</p>{item.ownerTimezone&&<p className="text-sm text-muted-foreground mt-1">Owner timezone: {item.ownerTimezone}</p>}</div>{item.manageToken&&new Date(item.startTime)>new Date()?<a href={`/manage/${encodeURIComponent(item.manageToken)}`}><Button className="w-full sm:w-auto"><RefreshCw className="w-4 h-4 mr-2"/>Reschedule</Button></a>:null}</div>{item.manageToken&&<div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2"><a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full">Google</Button></a><a href={outlookCalendarUrl(item)} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full">Outlook</Button></a><Button variant="outline" onClick={()=>downloadCalendarFile(item)}><Download className="w-4 h-4 mr-2"/>Calendar file</Button><Button variant="outline" onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/manage/${item.manageToken}`)}><Copy className="w-4 h-4 mr-2"/>Copy link</Button></div>}</article>;
  return <Layout><div className="space-y-8"><div><div className="flex items-center gap-3"><CalendarCheck2 className="w-8 h-8 text-primary"/><h1 className="text-4xl font-display font-bold">My Bookings</h1></div><p className="text-muted-foreground text-lg mt-2">Meetings you booked using a verified email on this account.</p></div>{loading?<div className="py-20 grid place-items-center"><Loader2 className="w-9 h-9 animate-spin text-primary"/></div>:error&&!bookings.length?<div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-destructive">{error}</div>:<><section className="space-y-4"><h2 className="text-2xl font-bold">Upcoming</h2>{upcoming.length?upcoming.map(card):<div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No upcoming guest bookings were found for your verified email.</div>}</section>{past.length>0&&<section className="space-y-4"><h2 className="text-2xl font-bold">Past</h2>{past.map(card)}</section>}</>}</div></Layout>
}
