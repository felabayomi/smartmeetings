import { toZonedTime, formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { parseISO } from "date-fns";

export const APP_TZ = typeof Intl !== "undefined"
  ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  : "UTC";

export const APP_TZ_LABEL = formatInTimeZone(new Date(), APP_TZ, "zzz");

export function detectedDeviceTimezone(): string {
  return typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";
}

export function timezoneAbbreviation(
  timezone: string,
  instant: string | Date = new Date(),
): string {
  try {
    return formatInTimeZone(instant, timezone, "zzz");
  } catch {
    return timezone;
  }
}

/** Parse a UTC ISO string (or Date) for calendar operations in the detected device timezone. */
export function toEST(utcSource: string | Date): Date {
  const d = typeof utcSource === "string" ? parseISO(utcSource) : utcSource;
  return toZonedTime(d, APP_TZ);
}

/** Format a UTC ISO string (or Date) in the detected device timezone. */
export function formatTimeEST(utcSource: string | Date, fmt = "h:mm a"): string {
  return formatInTimeZone(utcSource, APP_TZ, fmt);
}

/** Format a UTC ISO string (or Date) as a date in the detected device timezone. */
export function formatDateEST(utcSource: string | Date, fmt = "yyyy-MM-dd"): string {
  return formatInTimeZone(utcSource, APP_TZ, fmt);
}

/**
 * Format a UTC ISO string for use in a <input type="datetime-local">.
 * Returns "yyyy-MM-dd'T'HH:mm" in the detected device timezone.
 */
export function toDatetimeLocalEST(utcSource: string | Date | null | undefined): string {
  if (!utcSource) return "";
  try {
    return formatInTimeZone(utcSource, APP_TZ, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

/**
 * Interpret a datetime-local value in the detected device timezone and return UTC.
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
 * Return the calendar day key in the detected device timezone.
 */
export function estDayKey(utcSource: string | Date): string {
  return formatDateEST(utcSource, "yyyy-MM-dd");
}

/**
 * Returns true if the UTC source falls on today in the detected device timezone.
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
