import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptCalendarLink,
  decryptCalendarLink,
  calendarLinkToken,
} from "./calendar-link.cjs";
process.env.CALENDAR_LINK_ENCRYPTION_KEY = "test-only-secret";
const token = "a".repeat(43);
const url = `https://example.com/api/calendar-subscription/${token}.ics`;
test("stored links survive later retrieval and are encrypted with unique nonces", () => {
  const stored = encryptCalendarLink(url, "owner");
  assert.equal(decryptCalendarLink(stored, "owner"), url);
  assert.notEqual(stored, encryptCalendarLink(url, "owner"));
  assert.ok(!stored.includes(token));
  assert.throws(() => decryptCalendarLink(stored, "another-owner"));
  const bytes = Buffer.from(stored, "base64url");
  bytes[30] ^= 1;
  assert.throws(() =>
    decryptCalendarLink(bytes.toString("base64url"), "owner"),
  );
});
test("legacy links require the exact feed path and token format", () => {
  assert.equal(calendarLinkToken(url), token);
  assert.equal(calendarLinkToken(url.replace("https:", "webcal:")), token);
  for (const invalid of [
    "invalid",
    url + "?x=1",
    url + "#x",
    url.replace("/api/", "/"),
    url.replace(token, "short"),
  ]) {
    assert.equal(calendarLinkToken(invalid), null);
  }
});

// Exercise the actual route bodies with a database double, including persistence
// between independent requests. Authentication is handled before these routes.
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
const source = readFileSync(
  new URL("../api/index.ts", import.meta.url),
  "utf8",
);
const routes = source.slice(
  source.indexOf(
    '    if (path === "/calendar-subscription" && request.method === "GET")',
  ),
  source.indexOf(
    '    if (path.startsWith("/meetings")) await ensureImportTables(pool);',
  ),
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction(
  "path",
  "request",
  "response",
  "pool",
  "userId",
  "ensureCalendarFeedTables",
  "randomBytes",
  "calendarFeedTokenHash",
  "encryptCalendarLink",
  "decryptCalendarLink",
  "calendarLinkToken",
  routes,
);
test("create, revisit, restore legacy link, replace and revoke preserve expected subscriptions", async () => {
  let row;
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const pool = {
    async query(sql, args) {
      if (sql.includes("INSERT INTO"))
        row = {
          user_id: args[0],
          token_hash: args[1],
          encrypted_link: args[2],
          created_at: "created",
          updated_at: "updated",
        };
      else if (sql.includes("SET encrypted_link")) {
        if (
          !row ||
          row.revoked ||
          row.user_id !== args[0] ||
          row.token_hash !== args[1]
        )
          return { rowCount: 0, rows: [] };
        row.encrypted_link = args[2];
      } else if (sql.includes("SET revoked_at")) {
        row.revoked = true;
        row.encrypted_link = null;
      } else if (!row || row.revoked || row.user_id !== args[0])
        return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [row] };
    },
  };
  async function request(method, body, userId = "owner") {
    const response = {
      status(code) {
        this.code = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await run(
      "/calendar-subscription",
      { method, body, headers: { host: "example.com" } },
      response,
      pool,
      userId,
      async () => {},
      randomBytes,
      hash,
      encryptCalendarLink,
      decryptCalendarLink,
      calendarLinkToken,
    );
    return response;
  }
  assert.equal((await request("GET")).data.active, false);
  const original = (await request("POST")).data.feedUrl;
  const originalHash = row.token_hash;
  assert.equal((await request("GET")).data.feedUrl, original);
  assert.equal((await request("GET", null, "other-user")).data.active, false);
  row.encrypted_link = null; // existing hash-only subscription
  assert.equal((await request("GET")).data.active, true);
  assert.equal((await request("GET")).data.feedUrl, null);
  assert.equal(
    (await request("PUT", { feedUrl: original }, "other-user")).code,
    400,
  );
  assert.equal((await request("PUT", { feedUrl: url })).code, 400);
  assert.equal((await request("PUT", { feedUrl: original })).code, 200);
  assert.equal((await request("GET")).data.feedUrl, original);
  assert.equal(row.token_hash, originalHash);
  const replacement = (await request("POST")).data.feedUrl;
  assert.notEqual(replacement, original);
  assert.equal((await request("PUT", { feedUrl: original })).code, 400);
  await request("DELETE");
  assert.equal(row.encrypted_link, null);
  assert.equal((await request("GET")).data.active, false);
  assert.equal((await request("PUT", { feedUrl: replacement })).code, 400);
});
