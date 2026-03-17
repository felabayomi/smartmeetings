import React, { useState } from 'react';
import { useGetMeetings } from '@workspace/api-client-react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { isToday, parseISO, isFuture, compareAsc } from 'date-fns';
import { Plus, Camera, Loader2, CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Layout } from '@/components/layout';
import { MeetingCard } from '@/components/meeting-card';
import { CalendarView } from '@/components/calendar-view';
import { MeetingForm } from '@/components/meeting-form';
import { AiUploadModal } from '@/components/ai-upload-modal';
import { useReminders } from '@/hooks/use-reminders';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: meetings, isLoading, error } = useGetMeetings();
  useReminders(); // Initialize background reminders

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
    setSelectedMeeting({
      ...extractedData,
      color: '#8b5cf6', // default color for AI extracted
    });
    setIsAiExtracted(true);
    setAiModalOpen(false);
    setFormOpen(true);
  };

  // Filter for Today's upcoming meetings
  const todayUpcoming = meetings
    ? meetings
        .filter(m => isToday(parseISO(m.startTime)) && isFuture(parseISO(m.startTime)))
        .sort((a, b) => compareAsc(parseISO(a.startTime), parseISO(b.startTime)))
    : [];

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-lg mt-1">Here's your schedule for today.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
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
