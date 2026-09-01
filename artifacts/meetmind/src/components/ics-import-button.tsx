import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { APP_TZ } from '@/lib/timezone';

type ImportEvent = {uid:string;title:string;startTime:string;endTime:string;timezone:string;floating:boolean;reminders:number[];notices:string[];alreadyImported:boolean};
type Preview = {name:string;timezone:string;events:ImportEvent[];warnings:string[]};
const reminderLabel = (m:number) => m===0?'At event time':m%1440===0?`${m/1440} days before`:m%60===0?`${m/60} hours before`:`${m} minutes before`;

export function IcsImportButton() {
  const [open,setOpen]=useState(false), [text,setText]=useState(''), [timezone,setTimezone]=useState(APP_TZ);
  const [preview,setPreview]=useState<Preview|null>(null), [selected,setSelected]=useState<string[]>([]);
  const [confirmed,setConfirmed]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const queryClient=useQueryClient(); const {toast}=useToast();
  const invalidatePreview=()=>{setPreview(null);setSelected([]);setConfirmed(false);setError('');};
  async function readFile(file?:File) {
    invalidatePreview();setText('');if(!file)return;
    if(file.size>524288){setError('Choose a calendar file smaller than 512 KB.');return;}
    setBusy(true);
    try{setText(await file.text());}catch{setError('Could not read this file.');}finally{setBusy(false);}
  }
  async function inspect() {
    setBusy(true);setError('');setConfirmed(false);
    try{
      const data=await customFetch<Preview>('/api/meetings/import-preview',{method:'POST',responseType:'json',body:JSON.stringify({text,timezone})});
      setPreview(data);setSelected(data.events.filter(e=>!e.alreadyImported).map(e=>e.uid));
    }catch(e){setPreview(null);setError(e instanceof Error?e.message:'Could not preview calendar.');}finally{setBusy(false);}
  }
  async function save() {
    if(!confirmed||!selected.length)return;
    setBusy(true);setError('');
    try{
      const result=await customFetch<{imported:number;skipped:number}>('/api/meetings/import',{method:'POST',responseType:'json',body:JSON.stringify({text,timezone,selectedUids:selected,confirmed:true})});
      await queryClient.invalidateQueries({queryKey:['/api/meetings']});
      toast({title:`Imported ${result.imported} events`,description:`${result.skipped} duplicates skipped. File reminders are saved in your calendar.`});
      setOpen(false);setText('');invalidatePreview();
    }catch(e){setError(e instanceof Error?e.message:'Import failed. You may retry without creating duplicates.');}finally{setBusy(false);}
  }
  return <>
    <Button variant="outline" className="flex-1 sm:flex-none rounded-xl h-12" onClick={()=>setOpen(true)}><FileUp className="w-5 h-5 mr-2"/>Import .ics</Button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Import calendar file</DialogTitle>
        <DialogDescription>Preview timed events and their reminders before saving. Your file is parsed privately by MeetMind, not sent to AI. Limit: 200 events, 512 KB.</DialogDescription>
        <label className="block space-y-2 text-sm font-medium">Calendar file (.ics)<Input type="file" accept=".ics,text/calendar" disabled={busy} onChange={e=>void readFile(e.target.files?.[0])}/></label>
        <label className="block space-y-2 text-sm font-medium">Timezone for dates without a timezone<Input value={timezone} disabled={busy} placeholder="America/New_York" onChange={e=>{setTimezone(e.target.value);invalidatePreview();}}/></label>
        <p className="text-xs text-muted-foreground">For example, a floating 9:00 AM remains 9:00 AM in the timezone you confirm. Explicit UTC or supported IANA timezones in the file are preserved. Preview times below are displayed in your selected timezone.</p>
        <Button onClick={()=>void inspect()} disabled={!text||busy||!timezone}>{busy&&<Loader2 className="w-4 h-4 animate-spin mr-2"/>}Preview events</Button>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        {preview&&<div className="space-y-4">
          <h3 className="font-bold">{preview.name} · {preview.events.length} readable events</h3>
          {preview.warnings.length>0&&<div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Not imported—please review separately:</p><ul className="list-disc pl-5">{preview.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setSelected(preview.events.filter(e=>!e.alreadyImported).map(e=>e.uid));setConfirmed(false);}}>Select all new</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setSelected([]);setConfirmed(false);}}>Clear selection</Button></div>
          <div className="space-y-3">{preview.events.map(event=><label key={event.uid} className="flex items-start gap-3 rounded-xl border p-3">
            <input type="checkbox" className="mt-1" disabled={busy||event.alreadyImported} checked={selected.includes(event.uid)} onChange={e=>{setSelected(items=>e.target.checked?[...items,event.uid]:items.filter(uid=>uid!==event.uid));setConfirmed(false);}}/>
            <span className="min-w-0 space-y-1 text-sm"><strong className="block break-words">{event.title}</strong><span className="block">{new Intl.DateTimeFormat(undefined,{timeZone:preview.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(event.startTime))} – {new Intl.DateTimeFormat(undefined,{timeZone:preview.timezone,timeStyle:'short'}).format(new Date(event.endTime))} ({preview.timezone})</span><span className="block text-muted-foreground">{event.floating?'Local time interpreted in':'Source timezone:'} {event.timezone}</span><span className="block">Reminders: {event.reminders.map(reminderLabel).join(' · ')}</span>{event.alreadyImported&&<span className="block font-semibold text-muted-foreground">Previously imported—will be skipped</span>}{event.notices.map((notice,i)=><span key={i} className="block text-xs text-amber-700">{notice}</span>)}</span>
          </label>)}</div>
          <p className="text-xs text-muted-foreground">Imported events occupy calendar time and affect booking availability. Alerts use your existing in-app/push reminders; device notifications still require permission. Past alerts are not replayed. All-day events, recurring ICS entries and unsupported alarms are listed above instead of guessed.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the dates, timezone, reminders, and any skipped entries.</label>
          <Button className="w-full" disabled={busy||!confirmed||!selected.length} onClick={()=>void save()}>Import {selected.length} selected events</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
