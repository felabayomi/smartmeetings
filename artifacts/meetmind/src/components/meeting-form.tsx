import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateMeeting, useUpdateMeeting, useDeleteMeeting } from '@workspace/api-client-react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Calendar, Clock, Link2, MapPin, AlignLeft, User, Bell, Palette, Loader2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  meetingUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  organizer: z.string().optional().nullable(),
  reminderMinutes: z.coerce.number().optional().nullable(),
  color: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#3b82f6', label: 'Blue' },
];

interface MeetingFormProps {
  initialData?: Partial<Meeting>;
  onSuccess: () => void;
  onCancel: () => void;
  isAiExtracted?: boolean;
}

export function MeetingForm({ initialData, onSuccess, onCancel, isAiExtracted }: MeetingFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!initialData?.id;

  const createMutation = useCreateMeeting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
        toast({ title: "Meeting created!" });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899'] });
        onSuccess();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to create", description: err.message });
      }
    }
  });

  const updateMutation = useUpdateMeeting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
        toast({ title: "Meeting updated!" });
        onSuccess();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to update", description: err.message });
      }
    }
  });

  const deleteMutation = useDeleteMeeting({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
        toast({ title: "Meeting deleted" });
        onSuccess();
      }
    }
  });

  // Format dates for local datetime input: YYYY-MM-DDThh:mm
  const formatForInput = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      // Shift to local timezone for the input
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      startTime: formatForInput(initialData?.startTime) || formatForInput(new Date().toISOString()),
      endTime: formatForInput(initialData?.endTime) || '',
      description: initialData?.description || '',
      location: initialData?.location || '',
      meetingUrl: initialData?.meetingUrl || '',
      organizer: initialData?.organizer || '',
      reminderMinutes: initialData?.reminderMinutes || 15,
      color: initialData?.color || '#6366f1',
    },
  });

  const onSubmit = (values: FormValues) => {
    // Convert local datetime input back to ISO string UTC
    const toIso = (val?: string | null) => {
      if (!val) return null;
      return new Date(val).toISOString();
    };

    const payload = {
      ...values,
      startTime: toIso(values.startTime)!,
      endTime: toIso(values.endTime),
    };

    if (isEditing && initialData.id) {
      updateMutation.mutate({ id: initialData.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
      <div className="bg-gradient-to-r from-primary/10 to-accent/5 p-6 border-b border-border flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {isAiExtracted ? "Review AI Details" : isEditing ? "Edit Meeting" : "New Meeting"}
          </h2>
          {isAiExtracted && (
            <p className="text-sm text-primary mt-1 flex items-center">
              <SparklesIcon className="w-3 h-3 mr-1" />
              Extracted from screenshot. Please verify.
            </p>
          )}
        </div>
        {isEditing && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (confirm('Are you sure you want to delete this meeting?')) {
                deleteMutation.mutate({ id: initialData.id! });
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          </Button>
        )}
      </div>

      <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground flex items-center"><AlignLeft className="w-4 h-4 mr-2" /> Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Team Sync" className="text-lg font-medium h-12 rounded-xl bg-background border-border shadow-sm focus-visible:ring-primary/20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><Calendar className="w-4 h-4 mr-2" /> Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="h-11 rounded-xl bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><Clock className="w-4 h-4 mr-2" /> End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" className="h-11 rounded-xl bg-background" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><MapPin className="w-4 h-4 mr-2" /> Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Room 4B or Address" className="h-11 rounded-xl bg-background" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meetingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><Link2 className="w-4 h-4 mr-2" /> Video Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://zoom.us/..." type="url" className="h-11 rounded-xl bg-background" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="organizer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground flex items-center"><User className="w-4 h-4 mr-2" /> Organizer</FormLabel>
                  <FormControl>
                    <Input placeholder="Name or Email" className="h-11 rounded-xl bg-background" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground flex items-center"><AlignLeft className="w-4 h-4 mr-2" /> Notes / Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Agenda items..." className="min-h-[100px] rounded-xl bg-background resize-none" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
              <FormField
                control={form.control}
                name="reminderMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><Bell className="w-4 h-4 mr-2" /> Reminder</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="h-11 rounded-xl bg-background">
                          <SelectValue placeholder="Select reminder time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">At time of event</SelectItem>
                        <SelectItem value="5">5 minutes before</SelectItem>
                        <SelectItem value="10">10 minutes before</SelectItem>
                        <SelectItem value="15">15 minutes before</SelectItem>
                        <SelectItem value="30">30 minutes before</SelectItem>
                        <SelectItem value="60">1 hour before</SelectItem>
                        <SelectItem value="1440">1 day before</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground flex items-center"><Palette className="w-4 h-4 mr-2" /> Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 items-center h-11">
                        {COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => field.onChange(color.value)}
                            className={cn(
                              "w-8 h-8 rounded-full flex-shrink-0 transition-transform",
                              field.value === color.value ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-110 opacity-70 hover:opacity-100"
                            )}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          </form>
        </Form>
      </div>

      <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3 mt-auto">
        <Button variant="outline" onClick={onCancel} className="rounded-xl h-11 px-6 font-semibold" disabled={isPending}>
          Cancel
        </Button>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={isPending}
          className="rounded-xl h-11 px-8 font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Meeting"}
        </Button>
      </div>
    </div>
  );
}

// Inline sparkes icon for simplicity
function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}
