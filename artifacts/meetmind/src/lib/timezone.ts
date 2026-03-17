import { toZonedTime, format as tzFormat, fromZonedTime } from "date-fns-tz";
import { parseISO } from "date-fns";

export const APP_TZ = "America/New_York";

/** Parse a UTC ISO string (or Date) and return a Date representing that moment in EST. */
export function toEST(utcSource: string | Date): Date {
  const d = typeof utcSource === "string" ? parseISO(utcSource) : utcSource;
  return toZonedTime(d, APP_TZ);
}

/** Format a UTC ISO string (or Date) as a time string in EST. */
export function formatTimeEST(utcSource: string | Date, fmt = "h:mm a"): string {
  return tzFormat(toEST(utcSource), fmt, { timeZone: APP_TZ });
}

/** Format a UTC ISO string (or Date) as a date string in EST. */
export function formatDateEST(utcSource: string | Date, fmt = "yyyy-MM-dd"): string {
  return tzFormat(toEST(utcSource), fmt, { timeZone: APP_TZ });
}

/**
 * Format a UTC ISO string for use in a <input type="datetime-local">.
 * Returns "yyyy-MM-dd'T'HH:mm" in EST.
 */
export function toDatetimeLocalEST(utcSource: string | Date | null | undefined): string {
  if (!utcSource) return "";
  try {
    return tzFormat(toEST(utcSource), "yyyy-MM-dd'T'HH:mm", { timeZone: APP_TZ });
  } catch {
    return "";
  }
}

/**
 * Take a datetime-local value (treated as EST) and return a UTC ISO string.
 * e.g. "2026-03-23T14:00" (EST) → "2026-03-23T19:00:00.000Z" (UTC)
 */
export function fromDatetimeLocalEST(localValue: string | null | undefined): string | null {
  if (!localValue) return null;
  try {
    // Parse the local value as if it's in EST, then convert to UTC
    const utc = fromZonedTime(localValue, APP_TZ);
    return utc.toISOString();
  } catch {
    return null;
  }
}

/**
 * Given a UTC ISO string, return the yyyy-MM-dd date string in EST.
 * Used to group calendar meetings by the correct EST day.
 */
export function estDayKey(utcSource: string | Date): string {
  return formatDateEST(utcSource, "yyyy-MM-dd");
}

/**
 * Returns true if the UTC source falls on today (in EST).
 */
export function isTodayEST(utcSource: string | Date): boolean {
  return estDayKey(utcSource) === formatDateEST(new Date(), "yyyy-MM-dd");
}

/**
 * Returns true if the UTC source is in the future.
 */
export function isFutureEST(utcSource: string | Date): boolean {
  const d = typeof utcSource === "string" ? parseISO(utcSource) : utcSource;
  return d > new Date();
}
