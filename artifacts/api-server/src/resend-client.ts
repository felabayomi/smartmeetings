// Resend integration via Replit Connectors
// @ts-nocheck
import { Resend } from "resend";

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Resend: Replit connector environment not available");
  }

  const data = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((r) => r.json())
    .then((d: any) => d.items?.[0]);

  if (!data?.settings?.api_key) {
    throw new Error("Resend: connector not connected or missing api_key");
  }

  return {
    apiKey: data.settings.api_key,
    fromEmail: data.settings.from_email ?? "MeetMind <reminders@smartmeetings.felixconsult.co>",
  };
}

// WARNING: Never cache this client — tokens/keys can rotate.
export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}
// @ts-nocheck
