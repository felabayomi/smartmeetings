import React from 'react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { isPast, parseISO } from 'date-fns';
import { MapPin, Clock, Video, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { formatTimeEST } from '@/lib/timezone';

interface MeetingCardProps {
  meeting: Meeting;
  onClick: (meeting: Meeting) => void;
  layoutId?: string;
}

export function MeetingCard({ meeting, onClick, layoutId }: MeetingCardProps) {
  const startDate = parseISO(meeting.startTime);
  const endDate = meeting.endTime ? parseISO(meeting.endTime) : null;
  const isExpired = isPast(endDate || startDate);

  const bgColor = meeting.color || '#6366f1';

  const style = {
    '--card-accent': bgColor,
    borderColor: isExpired ? 'var(--border)' : `${bgColor}40`,
  } as React.CSSProperties;

  return (
    <motion.div
      layoutId={layoutId}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(meeting)}
      style={style}
      className={cn(
        "relative cursor-pointer rounded-2xl p-5 transition-all duration-300 border-2 bg-card",
        isExpired
          ? "opacity-60 grayscale-[0.5] hover:grayscale-0 hover:opacity-100"
          : "shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-[var(--card-accent)]/10"
      )}
    >
      {/* Decorative side accent */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 rounded-r-full opacity-70"
        style={{ backgroundColor: bgColor }}
      />

      <div className="flex justify-between items-start mb-3">
        <h3 className="font-display font-bold text-lg leading-tight line-clamp-2 text-foreground pr-4">
          {meeting.title}
        </h3>
        <div className="text-right flex flex-col items-end flex-shrink-0">
          <span className="font-semibold text-foreground">
            {formatTimeEST(meeting.startTime)} <span className="text-[10px] text-muted-foreground font-normal">EST</span>
          </span>
          {endDate && (
            <span className="text-xs text-muted-foreground">
              to {formatTimeEST(meeting.endTime!)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {meeting.location && (
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mr-2 text-primary/70" />
            <span className="truncate">{meeting.location}</span>
          </div>
        )}

        {meeting.meetingUrl && !meeting.location && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Video className="w-4 h-4 mr-2 text-accent/70" />
            <span className="truncate">{meeting.meetingUrl}</span>
          </div>
        )}

        {meeting.organizer && (
          <div className="flex items-center text-sm text-muted-foreground">
            <User className="w-4 h-4 mr-2 text-secondary-foreground/50" />
            <span className="truncate">{meeting.organizer}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
