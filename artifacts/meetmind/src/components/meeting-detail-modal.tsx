import React from "react";
import { Meeting } from "@workspace/api-client-react/src/generated/api.schemas";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_TZ_LABEL, formatTimeEST, formatDateEST } from "@/lib/timezone";
import { parseISO, isPast } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  Link2,
  User,
  AlignLeft,
  Bell,
  Pencil,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceImageViewer } from "@/components/source-image-viewer";

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
}

function reminderLabel(mins: number | null | undefined): string | null {
  if (mins === null || mins === undefined) return null;
  if (mins === 0) return "At time of event";
  if (mins < 60) return `${mins} min before`;
  if (mins < 1440) return `${mins / 60} hr before`;
  const days = mins / 1440;
  return `${days} day${days !== 1 ? "s" : ""} before`;
}

export function MeetingDetailModal({
  meeting,
  isOpen,
  onClose,
  onEdit,
}: MeetingDetailModalProps) {
  if (!meeting) return null;

  const color = meeting.color || "#6366f1";
  const startDate = parseISO(meeting.startTime);
  const endDate = meeting.endTime ? parseISO(meeting.endTime) : null;
  const isPastMeeting = isPast(endDate || startDate);

  const reminders = [
    meeting.reminderMinutes,
    (meeting as any).reminderMinutes2,
    (meeting as any).reminderMinutes3,
  ]
    .map(reminderLabel)
    .filter(Boolean) as string[];

  const dateLabel = formatDateEST(meeting.startTime, "EEEE, MMMM d, yyyy");
  const startLabel = formatTimeEST(meeting.startTime, "h:mm a");
  const endLabel = endDate ? formatTimeEST(meeting.endTime!, "h:mm a") : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90dvh]">
        <DialogTitle className="sr-only">{meeting.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Meeting details
        </DialogDescription>

        {/* Top color banner */}
        <div
          className="h-1.5 w-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-5 space-y-4">
            {/* Title + close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-display font-bold text-foreground leading-snug break-words">
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
                className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              <DetailRow icon={<Calendar className="w-4 h-4" />} color={color}>
                <span className="font-medium text-foreground text-sm">
                  {dateLabel}
                </span>
              </DetailRow>

              <DetailRow icon={<Clock className="w-4 h-4" />} color={color}>
                <span className="font-medium text-foreground text-sm">
                  {startLabel}
                  {endLabel ? ` – ${endLabel}` : ""}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    {APP_TZ_LABEL}
                  </span>
                </span>
              </DetailRow>

              {meeting.location && (
                <DetailRow icon={<MapPin className="w-4 h-4" />} color={color}>
                  <span className="text-foreground text-sm break-words">
                    {meeting.location}
                  </span>
                </DetailRow>
              )}

              {meeting.organizer && (
                <DetailRow icon={<User className="w-4 h-4" />} color={color}>
                  <span className="text-foreground text-sm">
                    {meeting.organizer}
                  </span>
                </DetailRow>
              )}

              {meeting.meetingUrl && (
                <DetailRow icon={<Link2 className="w-4 h-4" />} color={color}>
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs break-all line-clamp-2 underline underline-offset-2"
                    style={{ color }}
                  >
                    {meeting.meetingUrl}
                  </a>
                </DetailRow>
              )}

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

              {(meeting.description || meeting.notes) && (
                <DetailRow
                  icon={<AlignLeft className="w-4 h-4" />}
                  color={color}
                  alignTop
                >
                  <p className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {meeting.description || meeting.notes}
                  </p>
                </DetailRow>
              )}
            </div>
          </div>
        </div>

        {/* Pinned footer */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-border space-y-2.5 bg-card">
          {(meeting as any).hasSourceImage && (
            <SourceImageViewer meetingId={meeting.id} color={color} />
          )}
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                className="w-full rounded-xl h-11 font-semibold gap-2 text-white"
                style={{ backgroundColor: color }}
              >
                <ExternalLink className="w-4 h-4" />
                Join Meeting
              </Button>
            </a>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl h-10 font-semibold"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                onClose();
                onEdit(meeting);
              }}
              className="flex-1 rounded-xl h-10 font-semibold"
              style={{ backgroundColor: color, color: "#fff" }}
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon,
  color,
  children,
  alignTop = false,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div
      className={cn("flex gap-3", alignTop ? "items-start" : "items-center")}
    >
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
