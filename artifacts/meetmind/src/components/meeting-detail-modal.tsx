import React from 'react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatTimeEST, formatDateEST } from '@/lib/timezone';
import { parseISO, isPast } from 'date-fns';
import {
  Calendar, Clock, MapPin, Link2, User, AlignLeft, Bell, Pencil, ExternalLink, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
}

function reminderLabel(mins: number | null | undefined): string | null {
  if (mins === null || mins === undefined) return null;
  if (mins === 0) return 'At time of event';
  if (mins < 60) return `${mins} min before`;
  if (mins < 1440) return `${mins / 60} hr before`;
  const days = mins / 1440;
  return `${days} day${days !== 1 ? 's' : ''} before`;
}

export function MeetingDetailModal({ meeting, isOpen, onClose, onEdit }: MeetingDetailModalProps) {
  if (!meeting) return null;

  const color = meeting.color || '#6366f1';
  const startDate = parseISO(meeting.startTime);
  const endDate = meeting.endTime ? parseISO(meeting.endTime) : null;
  const isPastMeeting = isPast(endDate || startDate);

  const reminders = [meeting.reminderMinutes, (meeting as any).reminderMinutes2, (meeting as any).reminderMinutes3]
    .map(reminderLabel)
    .filter(Boolean) as string[];

  const dateLabel = formatDateEST(meeting.startTime, 'EEEE, MMMM d, yyyy');
  const startLabel = formatTimeEST(meeting.startTime, 'h:mm a');
  const endLabel = endDate ? formatTimeEST(meeting.endTime!, 'h:mm a') : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">{meeting.title}</DialogTitle>
        <DialogDescription className="sr-only">Meeting details</DialogDescription>

        {/* Top color banner */}
        <div
          className="relative h-2 w-full"
          style={{ backgroundColor: color }}
        />

        <div className="p-6 space-y-5">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-display font-bold text-foreground leading-tight">
                {meeting.title}
              </h2>
              {isPastMeeting && (
                <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Past meeting
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            {/* Date */}
            <DetailRow icon={<Calendar className="w-4 h-4" />} color={color}>
              <span className="font-medium text-foreground">{dateLabel}</span>
            </DetailRow>

            {/* Time */}
            <DetailRow icon={<Clock className="w-4 h-4" />} color={color}>
              <span className="font-medium text-foreground">
                {startLabel}{endLabel ? ` – ${endLabel}` : ''} <span className="text-xs text-muted-foreground font-normal">EST</span>
              </span>
            </DetailRow>

            {/* Location */}
            {meeting.location && (
              <DetailRow icon={<MapPin className="w-4 h-4" />} color={color}>
                <span className="text-foreground">{meeting.location}</span>
              </DetailRow>
            )}

            {/* Organizer */}
            {meeting.organizer && (
              <DetailRow icon={<User className="w-4 h-4" />} color={color}>
                <span className="text-foreground">{meeting.organizer}</span>
              </DetailRow>
            )}

            {/* Meeting URL */}
            {meeting.meetingUrl && (
              <DetailRow icon={<Link2 className="w-4 h-4" />} color={color}>
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 flex items-center gap-1 truncate"
                >
                  Join meeting
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </DetailRow>
            )}

            {/* Reminders */}
            {reminders.length > 0 && (
              <DetailRow icon={<Bell className="w-4 h-4" />} color={color}>
                <div className="flex flex-wrap gap-1.5">
                  {reminders.map((r, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}

            {/* Notes / Description */}
            {(meeting.description || meeting.notes) && (
              <DetailRow icon={<AlignLeft className="w-4 h-4" />} color={color} alignTop>
                <p className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {meeting.description || meeting.notes}
                </p>
              </DetailRow>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl h-10 px-5">
            Close
          </Button>
          <Button
            onClick={() => { onClose(); onEdit(meeting); }}
            className="rounded-xl h-10 px-5 font-semibold"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon, color, children, alignTop = false
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={cn("flex gap-3", alignTop ? "items-start" : "items-center")}>
      <div
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
