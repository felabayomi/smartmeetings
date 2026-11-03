export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  reached: boolean;
};

export function countdownParts(
  target: string | Date,
  now = Date.now(),
): CountdownParts | null {
  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime)) return null;
  const difference = Math.max(0, targetTime - now);
  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference % 86_400_000) / 3_600_000),
    minutes: Math.floor((difference % 3_600_000) / 60_000),
    seconds: Math.floor((difference % 60_000) / 1_000),
    reached: difference === 0,
  };
}

export function meetingIsStillRelevant(
  meeting: { startTime: string; endTime?: string | null },
  now = Date.now(),
) {
  const end = meeting.endTime
    ? new Date(meeting.endTime).getTime()
    : new Date(meeting.startTime).getTime() + 60 * 60 * 1000;
  return Number.isFinite(end) && end > now;
}
