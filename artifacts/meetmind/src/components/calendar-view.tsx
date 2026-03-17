import React, { useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth,
  isSameDay, isToday
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_TZ, estDayKey, formatTimeEST } from '@/lib/timezone';

interface CalendarViewProps {
  meetings: Meeting[];
  onMeetingClick: (meeting: Meeting) => void;
  onDayClick: (date: Date) => void;
}

export function CalendarView({ meetings, onMeetingClick, onDayClick }: CalendarViewProps) {
  // currentDate is always treated as a "EST-local" reference date for the calendar grid
  const [currentDate, setCurrentDate] = useState(() => toZonedTime(new Date(), APP_TZ));
  const [direction, setDirection] = useState(0);

  const nextMonth = () => { setDirection(1); setCurrentDate(d => addMonths(d, 1)); };
  const prevMonth = () => { setDirection(-1); setCurrentDate(d => subMonths(d, 1)); };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group meetings by their EST day string — critical for correct date display
  const meetingsByDay = meetings.reduce((acc, meeting) => {
    const dayStr = estDayKey(meeting.startTime);
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  const todayInEST = toZonedTime(new Date(), APP_TZ);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 20 : -20, opacity: 0 }),
    center: { z: 0, x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 20 : -20, opacity: 0 }),
  };

  return (
    <div className="bg-card border border-border shadow-xl shadow-black/5 rounded-3xl overflow-hidden flex flex-col h-[640px] md:h-[720px]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">All times in Eastern Time (EST)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-full w-10 h-10 border-border bg-card hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(toZonedTime(new Date(), APP_TZ))} className="rounded-full px-4 border-border bg-card hover:bg-muted font-medium">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-full w-10 h-10 border-border bg-card hover:bg-muted">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-border bg-card">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 relative overflow-hidden bg-muted/10">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentDate.toISOString()}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 grid grid-cols-7 grid-rows-5 md:grid-rows-auto"
          >
            {days.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayMeetings = meetingsByDay[dayStr] || [];
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDate = isSameDay(day, todayInEST);

              // When clicking a day, emit a date treated as midnight EST
              const handleDayClick = () => {
                // We emit the day as a local Date; the form will convert it properly
                onDayClick(day);
              };

              return (
                <div
                  key={day.toString()}
                  onClick={handleDayClick}
                  className={cn(
                    "border-r border-b border-border/50 p-1 md:p-2 flex flex-col cursor-pointer transition-colors duration-200 hover:bg-secondary/50",
                    !isCurrentMonth ? "bg-muted/30 text-muted-foreground/50" : "bg-card text-foreground",
                    (i + 1) % 7 === 0 && "border-r-0"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                      isTodayDate ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : ""
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5 mt-0.5">
                    {dayMeetings.slice(0, 3).map(meeting => {
                      const color = meeting.color || '#6366f1';
                      return (
                        <div
                          key={meeting.id}
                          onClick={(e) => { e.stopPropagation(); onDayClick(day); }}
                          className="group relative flex items-stretch rounded-md overflow-hidden cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                          style={{ backgroundColor: `${color}18` }}
                          title={`${formatTimeEST(meeting.startTime, 'h:mm a')} · ${meeting.title}`}
                        >
                          {/* Color stripe */}
                          <div className="w-1 flex-shrink-0 rounded-l-md" style={{ backgroundColor: color }} />
                          {/* Content */}
                          <div className="px-1 py-0.5 min-w-0 flex-1">
                            {/* Time — always visible */}
                            <div
                              className="text-[9px] md:text-[10px] font-bold leading-tight"
                              style={{ color }}
                            >
                              {formatTimeEST(meeting.startTime, 'h:mm a')}
                            </div>
                            {/* Title — hidden on very small cells, visible md+ */}
                            <div className="hidden md:block text-[9px] leading-tight truncate text-foreground/70 font-medium">
                              {meeting.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {dayMeetings.length > 3 && (
                      <div
                        className="text-[9px] md:text-[10px] text-muted-foreground font-semibold pl-1.5 py-0.5"
                      >
                        +{dayMeetings.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
