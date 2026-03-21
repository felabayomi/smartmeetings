const ADMIN_TOKEN = "admin/ark/felixdgreat";
const STORAGE_KEY = "meetmind_calendar_token";

/**
 * Derive the calendar token from the current URL path.
 *
 * Rules:
 *  - /admin/ark/felixdgreat[/...] → "admin/ark/felixdgreat"
 *  - /{uuid}[/...] → "{uuid}"  (single-segment UUID)
 *  - / (root, no segment)     → generate UUID, persist in localStorage, redirect
 */
export function getCalendarToken(): string {
  const path = window.location.pathname;

  // Admin secret URL (3-segment path)
  if (path === `/${ADMIN_TOKEN}` || path.startsWith(`/${ADMIN_TOKEN}/`)) {
    return ADMIN_TOKEN;
  }

  // Any other non-root path: use the first path segment as the token
  const segments = path.replace(/^\//, "").split("/");
  if (segments[0] && segments[0].length > 0) {
    return segments[0];
  }

  // Root /: look for a saved token in localStorage, or mint a new UUID
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    window.location.replace(`/${saved}`);
    return saved;
  }

  const newToken = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, newToken);
  window.location.replace(`/${newToken}`);
  return newToken;
}

/** Wouter base for the current calendar token. */
export function getRouterBase(token: string): string {
  return `/${token}`;
}

/** Persist a token as the user's "home" (for root-URL redirect). */
export function persistToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}
