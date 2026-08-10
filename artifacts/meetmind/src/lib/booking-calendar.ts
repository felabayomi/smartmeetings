export type SavedGuestBooking = {
  id: string;
  manageToken: string;
  hostName: string;
  startTime: string;
  endTime: string;
  ownerTimezone?: string;
};

const STORAGE_KEY = "meetmind.guest-bookings.v1";

export function rememberGuestBooking(booking: SavedGuestBooking) {
  try {
    const current = readGuestBookings().filter((item) => item.id !== booking.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([booking, ...current].slice(0, 50)));
  } catch { /* Storage can be unavailable in private browsing. */ }
}

export function readGuestBookings(): SavedGuestBooking[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function compactDate(iso: string) { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function details(booking: SavedGuestBooking) { return `Manage or reschedule this meeting: ${window.location.origin}/manage/${booking.manageToken}`; }

export function googleCalendarUrl(booking: SavedGuestBooking) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Meeting with ${booking.hostName}`,
    dates: `${compactDate(booking.startTime)}/${compactDate(booking.endTime)}`,
    details: details(booking),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(booking: SavedGuestBooking) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `Meeting with ${booking.hostName}`,
    startdt: booking.startTime,
    enddt: booking.endTime,
    body: details(booking),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

export function downloadCalendarFile(booking: SavedGuestBooking) {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const content = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MeetMind//Booking//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${booking.id}@meetminder.app`, `DTSTAMP:${compactDate(new Date().toISOString())}`,
    `DTSTART:${compactDate(booking.startTime)}`, `DTEND:${compactDate(booking.endTime)}`,
    `SUMMARY:${escape(`Meeting with ${booking.hostName}`)}`, `DESCRIPTION:${escape(details(booking))}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "meetmind-booking.ics"; link.click();
  URL.revokeObjectURL(url);
}
