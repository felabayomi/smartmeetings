import React, { useState } from 'react';
import { useGetMeetings } from '@workspace/api-client-react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { compareAsc, parseISO } from 'date-fns';
import { isTodayEST, isFutureEST } from '@/lib/timezone';
import { Plus, Camera, Loader2, CalendarX, BellRing, BellOff, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Layout } from '@/components/layout';
import { MeetingCard } from '@/components/meeting-card';
import { CalendarView } from '@/components/calendar-view';
import { MeetingForm } from '@/components/meeting-form';
import { AiUploadModal } from '@/components/ai-upload-modal';
import { useReminders } from '@/hooks/use-reminders';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Dashboard() {
  const { data: meetings, isLoading, error } = useGetMeetings();
  useReminders(); // In-app background reminders (when app is open)

  const { state: pushState, subscribe, unsubscribe } = usePushNotifications();

  const [formOpen, setFormOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Partial<Meeting> | undefined>(undefined);
  const [isAiExtracted, setIsAiExtracted] = useState(false);

  const openNewMeeting = () => {
    setSelectedMeeting(undefined);
    setIsAiExtracted(false);
    setFormOpen(true);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsAiExtracted(false);
    setFormOpen(true);
  };

  const handleAiExtracted = (extractedData: any) => {
    setSelectedMeeting({ ...extractedData, color: '#8b5cf6' });
    setIsAiExtracted(true);
    setAiModalOpen(false);
    setFormOpen(true);
  };

  // Filter for today's upcoming meetings using EST timezone
  const todayUpcoming = meetings
    ? meetings
        .filter(m => isTodayEST(m.startTime) && isFutureEST(m.startTime))
        .sort((a, b) => compareAsc(parseISO(a.startTime), parseISO(b.startTime)))
    : [];

  const pushButton = () => {
    if (pushState === "unsupported") return null;
    if (pushState === "loading") return (
      <Button variant="outline" disabled className="rounded-xl h-12 px-4 border-border">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
    if (pushState === "denied") return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" disabled className="rounded-xl h-12 px-4 border-destructive/30 text-destructive/60">
            <BellOff className="w-4 h-4 mr-2" /> Blocked
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifications blocked in browser settings</TooltipContent>
      </Tooltip>
    );
    if (pushState === "subscribed") return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={unsubscribe}
            className="rounded-xl h-12 px-4 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
          >
            <BellRing className="w-4 h-4 mr-2" />
            Alerts On
          </Button>
        </TooltipTrigger>
        <TooltipContent>Push alerts active — click to turn off</TooltipContent>
      </Tooltip>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={subscribe}
            className="rounded-xl h-12 px-4 border-primary/20 text-primary hover:bg-primary/5"
          >
            <Bell className="w-4 h-4 mr-2" />
            Enable Alerts
          </Button>
        </TooltipTrigger>
        <TooltipContent>Get push alerts even when the app is closed</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Layout>
      <div className="space-y-8 pb-20">

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-lg mt-1">Here's your schedule for today.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto flex-wrap">
            {pushButton()}
            <Button
              variant="outline"
              className="flex-1 sm:flex-none rounded-xl h-12 px-4 border-primary/20 hover:bg-primary/5 text-primary hover:text-primary transition-all font-semibold"
              onClick={() => setAiModalOpen(true)}
            >
              <Camera className="w-5 h-5 mr-2" />
              Scan Image
            </Button>
            <Button
              className="flex-1 sm:flex-none rounded-xl h-12 px-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5 font-semibold bg-gradient-to-r from-primary to-primary/80"
              onClick={openNewMeeting}
            >
              <Plus className="w-5 h-5 mr-2" />
              New Meeting
            </Button>
          </div>
        </div>

        {/* Push alert banner for first-time users */}
        <AnimatePresence>
          {pushState === "prompt" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/20"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Never miss a meeting</p>
                <p className="text-muted-foreground text-sm">Enable push alerts to get notified even when MeetMind is closed.</p>
              </div>
              <Button
                size="sm"
                onClick={subscribe}
                className="flex-shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                Enable
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today's Horizontal Scroll */}
        {isLoading ? (
          <div className="flex space-x-4 overflow-x-auto pb-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[300px] h-32 rounded-2xl bg-muted/50 animate-pulse border border-border" />
            ))}
          </div>
        ) : todayUpcoming.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xl font-display font-bold text-foreground flex items-center">
              Today <span className="ml-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{todayUpcoming.length} upcoming</span>
            </h2>
            <div className="flex space-x-4 overflow-x-auto pb-6 hide-scrollbar snap-x">
              {todayUpcoming.map(meeting => (
                <div key={meeting.id} className="min-w-[300px] w-[300px] sm:min-w-[350px] snap-start">
                  <MeetingCard meeting={meeting} onClick={handleMeetingClick} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center text-center border-dashed border-2">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CalendarX className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground">No upcoming meetings today</h3>
            <p className="text-muted-foreground mt-1 max-w-sm">You have a clear schedule. Time to focus on deep work or take a break!</p>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="mt-8">
          {isLoading ? (
            <div className="h-[600px] rounded-3xl bg-muted/20 animate-pulse border border-border" />
          ) : error ? (
            <div className="p-8 text-center text-destructive bg-destructive/10 rounded-2xl border border-destructive/20">
              Error loading meetings. Please try again.
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <CalendarView
                meetings={meetings || []}
                onMeetingClick={handleMeetingClick}
                onDayClick={(date) => {
                  setSelectedMeeting({ startTime: date.toISOString() });
                  setFormOpen(true);
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AiUploadModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onExtracted={handleAiExtracted}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Meeting Details</DialogTitle>
          <DialogDescription className="sr-only">Create or edit a meeting.</DialogDescription>
          {formOpen && (
            <MeetingForm
              initialData={selectedMeeting}
              isAiExtracted={isAiExtracted}
              onSuccess={() => setFormOpen(false)}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
