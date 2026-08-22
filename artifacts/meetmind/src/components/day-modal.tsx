import React from "react";
import { Meeting } from "@workspace/api-client-react/src/generated/api.schemas";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_TZ_LABEL, formatTimeEST, estDayKey } from "@/lib/timezone";
import { parseISO, isPast } from "date-fns";
import { format } from "date-fns";
import { Plus, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SourceImageViewer } from "@/components/source-image-viewer";

interface DayModalProps {
  date: Date | null;
  meetings: Meeting[];
  isOpen: boolean;
  onClose: () => void;
  onMeetingClick: (meeting: Meeting) => void;
  onAddMeeting: (date: Date) => void;
}

export function DayModal({
  date,
  meetings,
  isOpen,
  onClose,
  onMeetingClick,
  onAddMeeting,
}: DayModalProps) {
  if (!date) return null;

  // Get the day string in EST to filter correctly
  const dayStr = format(date, "yyyy-MM-dd");
  const dayMeetings = meetings
    .filter((m) => estDayKey(m.startTime) === dayStr)
    .sort(
      (a, b) =>
        parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime(),
    );

  const dateLabel = format(date, "EEEE, MMMM d");
  const yearLabel = format(date, "yyyy");
  const isToday = dayStr === format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90dvh]">
        <DialogTitle className="sr-only">{dateLabel}</DialogTitle>
        <DialogDescription className="sr-only">
          Meetings on {dateLabel}
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold shadow-sm",
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase leading-none opacity-70">
                {format(date, "MMM")}
              </span>
              <span className="text-xl leading-tight">{format(date, "d")}</span>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-foreground leading-tight">
                {dateLabel}
              </h2>
              <p className="text-sm text-muted-foreground">{yearLabel}</p>
            </div>
          </div>
          {isToday && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              Today
            </span>
          )}
        </div>

        {/* Meeting list */}
        <div className="px-6 py-4 min-h-[80px] max-h-[50vh] overflow-y-auto space-y-2">
          {dayMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground font-medium text-sm">
                No meetings on this day
              </p>
              <p className="text-muted-foreground/60 text-xs mt-0.5">
                Tap below to schedule one
              </p>
            </div>
          ) : (
            dayMeetings.map((meeting) => {
              const color = meeting.color || "#6366f1";
              const endDate = meeting.endTime
                ? parseISO(meeting.endTime)
                : null;
              const past = isPast(endDate || parseISO(meeting.startTime));
              return (
                <motion.div
                  key={meeting.id}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "w-full flex items-stretch rounded-xl border transition-all hover:shadow-sm group",
                    past ? "opacity-60" : "hover:border-border",
                  )}
                  style={{
                    borderColor: `${color}30`,
                    backgroundColor: `${color}08`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onMeetingClick(meeting);
                    }}
                    className="flex flex-1 min-w-0 items-stretch gap-3 p-3 text-left"
                  >
                    {/* Color stripe */}
                    <div
                      className="w-1 flex-shrink-0 rounded-full self-stretch"
                      style={{ backgroundColor: color }}
                    />
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-semibold text-sm leading-tight truncate",
                          past ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {meeting.title}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color }}
                        />
                        <span className="text-xs font-medium" style={{ color }}>
                          {formatTimeEST(meeting.startTime, "h:mm a")}
                          {endDate &&
                            ` – ${formatTimeEST(meeting.endTime!, "h:mm a")}`}{" "}
                          {APP_TZ_LABEL}
                        </span>
                      </div>
                      {meeting.organizer && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {meeting.organizer}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 pr-2">
                    {(meeting as any).hasSourceImage && (
                      <SourceImageViewer
                        meetingId={meeting.id}
                        iconOnly
                        color={color}
                      />
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-border">
          <Button
            className="w-full rounded-xl h-11 font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
            onClick={() => {
              onClose();
              onAddMeeting(date);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Meeting on {format(date, "MMM d")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
