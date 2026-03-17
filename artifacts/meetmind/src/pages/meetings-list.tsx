import React, { useState } from 'react';
import { useGetMeetings } from '@workspace/api-client-react';
import { Meeting } from '@workspace/api-client-react/src/generated/api.schemas';
import { parseISO, compareAsc, isFuture, isPast } from 'date-fns';
import { Layout } from '@/components/layout';
import { MeetingCard } from '@/components/meeting-card';
import { MeetingForm } from '@/components/meeting-form';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

export default function MeetingsList() {
  const { data: meetings, isLoading } = useGetMeetings();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [selectedMeeting, setSelectedMeeting] = useState<Partial<Meeting> | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setFormOpen(true);
  };

  const filteredMeetings = meetings?.filter(m => {
    // Search
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                          (m.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
                          (m.organizer?.toLowerCase() || '').includes(search.toLowerCase());
    if (!matchesSearch) return false;

    // Time filter
    const start = parseISO(m.startTime);
    if (filter === 'upcoming') return isFuture(start);
    if (filter === 'past') return isPast(start);
    return true;
  }).sort((a, b) => {
    const asc = compareAsc(parseISO(a.startTime), parseISO(b.startTime));
    return filter === 'past' ? -asc : asc; // Reverse sort for past meetings
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground">All Meetings</h1>
          <p className="text-muted-foreground text-lg mt-1">Manage and search your entire schedule.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between glass-panel p-4 rounded-2xl">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search meetings..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-card border-border/50 focus-visible:ring-primary/20"
            />
          </div>
          
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full sm:w-auto">
            <TabsList className="h-12 p-1 bg-card rounded-xl border border-border/50 w-full grid grid-cols-3">
              <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Upcoming</TabsTrigger>
              <TabsTrigger value="past" className="rounded-lg">Past</TabsTrigger>
              <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
          </div>
        ) : filteredMeetings && filteredMeetings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredMeetings.map((meeting) => (
                <motion.div
                  key={meeting.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <MeetingCard meeting={meeting} onClick={handleMeetingClick} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center">
            <img src={`${import.meta.env.BASE_URL}images/empty-calendar.png`} alt="Empty" className="w-64 h-64 object-contain opacity-80" />
            <h3 className="text-xl font-display font-bold mt-6 text-foreground">No meetings found</h3>
            <p className="text-muted-foreground mt-2">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Meeting Details</DialogTitle>
          <DialogDescription className="sr-only">Edit a meeting.</DialogDescription>
          {formOpen && (
            <MeetingForm 
              initialData={selectedMeeting} 
              onSuccess={() => setFormOpen(false)}
              onCancel={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
