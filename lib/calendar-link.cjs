const {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} = require("node:crypto");

// Domain-separate this key from other uses of the application's existing secret.
// Keep CALENDAR_LINK_ENCRYPTION_KEY stable if rotating CLERK_SECRET_KEY.
function key() {
  const secret =
    process.env.CALENDAR_LINK_ENCRYPTION_KEY || process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("Calendar link encryption secret is required");
  return createHash("sha256")
    .update(`calendar-subscription:v1:${secret}`)
    .digest();
}
function encryptCalendarLink(url, userId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
function decryptCalendarLink(value, userId) {
  const data = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
function calendarLinkToken(value) {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:", "webcal:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return (
      /^\/api\/calendar-subscription\/([A-Za-z0-9_-]{43})\.ics$/.exec(
        url.pathname,
      )?.[1] || null
    );
  } catch {
    return null;
  }
}
module.exports = {
  encryptCalendarLink,
  decryptCalendarLink,
  calendarLinkToken,
};
