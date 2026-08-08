import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { fromZonedTime } from "date-fns-tz";
import { CalendarClock, Check, Clipboard, ExternalLink, Link2, Loader2, Plus, Users } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Window = { day: number; enabled: boolean; start: string; end: string };
type Profile = { slug: string; displayName: string; timezone: string; durationMinutes: number; bufferMinutes: number; availability: Window[] };
type Poll = { id: string; slug: string; title: string; timezone: string; options: string[]; status: string; counts: Record<string, number>; responseCount: number; finalStart?: string };
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const defaults: Window[] = [1,2,3,4,5,6,0].map(day => ({ day, enabled: day > 0 && day < 6, start: "09:00", end: "17:00" }));

function browserTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; }
function displayDate(iso: string, timezone: string) { return new Intl.DateTimeFormat(undefined, { dateStyle:"medium", timeStyle:"short", timeZone: timezone }).format(new Date(iso)); }

export default function Scheduling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey:["scheduling-profile"], queryFn:() => customFetch<Profile | null>("/api/scheduling/profile", { responseType:"json" }) });
  const pollsQuery = useQuery({ queryKey:["scheduling-polls"], queryFn:() => customFetch<Poll[]>("/api/scheduling/polls", { responseType:"json" }) });
  const existing = profileQuery.data;
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [availability, setAvailability] = useState<Window[]>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (existing && !hydrated) {
      setDisplayName(existing.displayName); setTimezone(existing.timezone); setDuration(existing.durationMinutes); setBuffer(existing.bufferMinutes); setAvailability(existing.availability); setHydrated(true);
    }
  }, [existing, hydrated]);

  const saveProfile = useMutation({
    mutationFn:() => customFetch<Profile>("/api/scheduling/profile", { method:"PUT", responseType:"json", body:JSON.stringify({ displayName, timezone, durationMinutes:duration, bufferMinutes:buffer, availability }) }),
    onSuccess:(data) => { queryClient.setQueryData(["scheduling-profile"], data); toast({title:"Booking page saved",description:"Your public availability is live."}); },
    onError:(error:Error) => toast({variant:"destructive",title:"Could not save",description:error.message}),
  });

  const bookingUrl = existing ? `${window.location.origin}/book/${existing.slug}` : "";
  const updateWindow = (day:number, patch:Partial<Window>) => setAvailability(items => items.map(item => item.day === day ? {...item,...patch} : item));

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">Your booking page</h2><p className="text-muted-foreground">Only open times are public. Calendar details stay private.</p></div>{bookingUrl && <div className="flex gap-2"><Button variant="outline" onClick={() => {navigator.clipboard.writeText(bookingUrl);toast({title:"Link copied"})}}><Clipboard className="w-4 h-4 mr-2"/>Copy link</Button><a href={bookingUrl} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="w-4 h-4"/></Button></a></div>}</div>
      <div className="grid md:grid-cols-2 gap-5"><label className="space-y-2"><span className="text-sm font-semibold">Name shown to bookers</span><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Felix"/></label><label className="space-y-2"><span className="text-sm font-semibold">Owner timezone</span><Input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="America/New_York"/></label><label className="space-y-2"><span className="text-sm font-semibold">Meeting length (minutes)</span><Input type="number" min={15} max={180} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label className="space-y-2"><span className="text-sm font-semibold">Buffer after meetings (minutes)</span><Input type="number" min={0} max={60} value={buffer} onChange={e=>setBuffer(Number(e.target.value))}/></label></div>
      <div className="space-y-3"><h3 className="font-bold">Weekly availability</h3>{availability.map(item=><div key={item.day} className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_100px_1fr_1fr] gap-3 items-center rounded-2xl border p-3"><span className="font-medium">{dayNames[item.day]}</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={e=>updateWindow(item.day,{enabled:e.target.checked})}/>{item.enabled?"Available":"Closed"}</label>{item.enabled&&<><Input type="time" value={item.start} onChange={e=>updateWindow(item.day,{start:e.target.value})}/><Input type="time" value={item.end} onChange={e=>updateWindow(item.day,{end:e.target.value})}/></>}</div>)}</div>
      <Button size="lg" onClick={()=>saveProfile.mutate()} disabled={saveProfile.isPending||!displayName} className="rounded-xl">{saveProfile.isPending?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<Check className="w-4 h-4 mr-2"/>}Save and publish</Button>
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
