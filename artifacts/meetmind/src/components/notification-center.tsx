import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCheck2, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

type Alert = { id:string; type:"booking"|"reminder"; title:string; body:string; meetingId:number|null; createdAt:string; readAt:string|null };

export function NotificationCenter(){
  const {getToken}=useAuth();
  const queryClient=useQueryClient();
  const {toast}=useToast();
  const [alerts,setAlerts]=useState<Alert[]>([]);
  const [unread,setUnread]=useState(0);
  const [loading,setLoading]=useState(true);
  const initialized=useRef(false);
  const newestId=useRef<string|null>(null);

  const refresh=useCallback(async()=>{
    try{
      const token=await getToken();
      if(!token)return;
      await fetch("/api/push/send-reminders",{headers:{Authorization:`Bearer ${token}`}});
      const response=await fetch("/api/notifications",{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error("Could not load notifications");
      const data=await response.json() as {notifications:Alert[];unreadCount:number};
      const latest=data.notifications[0];
      if(initialized.current&&latest&&latest.id!==newestId.current){
        const newAlerts=[] as Alert[];
        for(const item of data.notifications){if(item.id===newestId.current)break;if(!item.readAt)newAlerts.push(item)}
        newAlerts.slice(0,3).reverse().forEach(item=>toast({title:item.title,description:item.body,duration:10000}));
        if(newAlerts.some(item=>item.type==="booking"))void queryClient.invalidateQueries({queryKey:["/api/meetings"]});
      }
      newestId.current=latest?.id||null;
      initialized.current=true;
      setAlerts(data.notifications);setUnread(data.unreadCount);
    }catch(error){console.warn("Notification refresh failed:",error)}finally{setLoading(false)}
  },[getToken,queryClient,toast]);

  useEffect(()=>{void refresh();const interval=window.setInterval(refresh,30_000);const resume=()=>{if(document.visibilityState==="visible")void refresh()};document.addEventListener("visibilitychange",resume);return()=>{window.clearInterval(interval);document.removeEventListener("visibilitychange",resume)}},[refresh]);

  const markAllRead=async()=>{const token=await getToken();const response=await fetch("/api/notifications/read",{method:"POST",headers:{Authorization:`Bearer ${token}`}});if(response.ok){setUnread(0);setAlerts(items=>items.map(item=>({...item,readAt:item.readAt||new Date().toISOString()})))}};

  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={unread?`${unread} unread notifications`:"Notifications"}><Bell className="w-5 h-5"/>{unread>0?<span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold grid place-items-center">{unread>9?"9+":unread}</span>:null}</Button></PopoverTrigger><PopoverContent align="end" className="w-[min(92vw,380px)] p-0"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-bold">Notifications</h2><p className="text-xs text-muted-foreground">Bookings and meeting reminders</p></div>{unread>0?<Button size="sm" variant="ghost" onClick={markAllRead}><Check className="w-4 h-4 mr-1"/>Mark read</Button>:null}</div><div className="max-h-[420px] overflow-y-auto">{loading?<div className="p-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary"/></div>:alerts.length?alerts.map(item=><div key={item.id} className={`flex gap-3 p-4 border-b last:border-0 ${item.readAt?"":"bg-primary/5"}`}><div className="mt-0.5 w-9 h-9 rounded-xl bg-primary/10 grid place-items-center flex-shrink-0">{item.type==="booking"?<CalendarCheck2 className="w-4 h-4 text-primary"/>:<Clock className="w-4 h-4 text-primary"/>}</div><div className="min-w-0"><p className="font-semibold text-sm">{item.title}</p><p className="text-sm text-muted-foreground mt-0.5">{item.body}</p><p className="text-xs text-muted-foreground mt-1">{new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.createdAt))}</p></div></div>):<div className="p-10 text-center text-sm text-muted-foreground">No notifications yet.</div>}</div></PopoverContent></Popover>
}
