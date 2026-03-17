import React, { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, 
  isSameDay, isToday, parseISO 
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarViewProps {
  meetings: Meeting[];
  onMeetingClick: (meeting: Meeting) => void;
  onDayClick: (date: Date) => void;
}

export function CalendarView({ meetings, onMeetingClick, onDayClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0);

  const nextMonth = () => {
    setDirection(1);
    setCurrentDate(addMonths(currentDate, 1));
  };
  
  const prevMonth = () => {
    setDirection(-1);
    setCurrentDate(subMonths(currentDate, 1));
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group meetings by date string 'yyyy-MM-dd'
  const meetingsByDay = meetings.reduce((acc, meeting) => {
    const dayStr = format(parseISO(meeting.startTime), 'yyyy-MM-dd');
    if (!acc[dayStr]) acc[dayStr] = [];
    acc[dayStr].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 20 : -20,
      opacity: 0
    }),
    center: {
      z: 0,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 20 : -20,
      opacity: 0
    })
  };

  return (
    <div className="bg-card border border-border shadow-xl shadow-black/5 rounded-3xl overflow-hidden flex flex-col h-[600px] md:h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
        <h2 className="text-2xl font-display font-bold text-foreground">
          {format(currentDate, dateFormat)}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-full w-10 h-10 border-border bg-card hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())} className="rounded-full px-4 border-border bg-card hover:bg-muted font-medium">
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
              const isTodayDate = isToday(day);

              return (
                <div 
                  key={day.toString()} 
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "border-r border-b border-border/50 p-1 md:p-2 flex flex-col cursor-pointer transition-colors duration-200 hover:bg-secondary/50",
                    !isCurrentMonth ? "bg-muted/30 text-muted-foreground/50" : "bg-card text-foreground",
                    // Fix border on right edge
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
                  
                  <div className="flex-1 overflow-y-auto hide-scrollbar space-y-1">
                    {dayMeetings.slice(0, 4).map(meeting => (
                      <div 
                        key={meeting.id}
                        onClick={(e) => { e.stopPropagation(); onMeetingClick(meeting); }}
                        className="text-[10px] md:text-xs px-1.5 py-1 rounded truncate border hover:brightness-95 transition-all"
                        style={{ 
                          backgroundColor: `${meeting.color || '#6366f1'}15`,
                          borderColor: `${meeting.color || '#6366f1'}30`,
                          color: meeting.color || '#6366f1' 
                        }}
                      >
                        <span className="font-semibold mr-1">{format(parseISO(meeting.startTime), 'HH:mm')}</span>
                        {meeting.title}
                      </div>
                    ))}
                    {dayMeetings.length > 4 && (
                      <div className="text-[10px] text-muted-foreground font-medium pl-1">
                        +{dayMeetings.length - 4} more
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
