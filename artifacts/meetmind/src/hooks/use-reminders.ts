import { useEffect, useRef } from 'react';
import { useGetMeetings } from '@workspace/api-client-react';
import { differenceInMinutes, isFuture, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function useReminders() {
  const { data: meetings } = useGetMeetings();
  const notifiedSet = useRef<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    // Request permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!meetings || meetings.length === 0) return;

    const checkReminders = () => {
      const now = new Date();

      meetings.forEach(meeting => {
        if (notifiedSet.current.has(meeting.id)) return;

        const startTime = parseISO(meeting.startTime);
        if (!isFuture(startTime)) return;

        const reminderMins = meeting.reminderMinutes || 15;
        const minsUntil = differenceInMinutes(startTime, now);

        if (minsUntil >= 0 && minsUntil <= reminderMins) {
          // Trigger Notification
          triggerNotification(meeting);
          notifiedSet.current.add(meeting.id);
        }
      });
    };

    const triggerNotification = (meeting: any) => {
      const title = `Upcoming: ${meeting.title}`;
      const options = {
        body: `Starts at ${new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} \n${meeting.location || 'No location set'}`,
        icon: '/favicon.svg',
      };

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, options);
      }

      // Also show in-app toast
      toast({
        title: title,
        description: options.body,
        duration: 10000, // 10 seconds
      });
    };

    // Check immediately, then every minute
    checkReminders();
    const intervalId = setInterval(checkReminders, 60000);

    return () => clearInterval(intervalId);
  }, [meetings, toast]);
}
