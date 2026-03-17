import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ExtractMeetingFromImageBody } from "@workspace/api-zod";
import { toZonedTime, fromZonedTime, format as tzFormat } from "date-fns-tz";

const router: IRouter = Router();
const APP_TZ = "America/New_York";

/**
 * Convert an ISO datetime string with optional source timezone to an
 * EST ISO string. Falls back gracefully if conversion fails.
 */
function convertToEST(isoString: string | null, sourceTz?: string | null): string | null {
  if (!isoString) return null;
  try {
    // Always use fromZonedTime so that a bare ISO string (no Z) is treated as
    // local time in the source timezone — never as UTC.
    // If no timezone was detected, default to Eastern (the app's timezone).
    const tz = sourceTz || APP_TZ;
    const utcDate = fromZonedTime(isoString.replace("Z", ""), tz);
    if (isNaN(utcDate.getTime())) return null;
    return utcDate.toISOString();
  } catch {
    return null;
  }
}

router.post("/ai/extract-meeting", async (req, res) => {
  try {
    const body = ExtractMeetingFromImageBody.parse(req.body);
    const { imageBase64, mimeType } = body;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are an expert AI assistant that extracts meeting details from screenshots and images. You must intelligently understand the CONTEXT and TYPE of the image to correctly identify who the organizer is.

CRITICAL RULES FOR IDENTIFYING THE ORGANIZER:
- Microsoft Bookings page: The person shown with a profile photo and "Booking Page" label is the ORGANIZER/HOST. The name in the meeting title before a dash (e.g. "Felix Abayomi - Office hours") is the ATTENDEE who booked, NOT the organizer.
- Calendar invite / email invite: The sender or the person whose calendar it is is the organizer. "You have been invited by X" means X is the organizer.
- Webinar / event page (WebinarJam, Zoom, etc.): The "Hosted by" person is the organizer.
- Zoom / Teams meeting invite: The person who sent the invite is the organizer.
- Google Calendar invite: Look for "Organizer:" label explicitly.
- Generic email: The FROM address or the person described as "host" is the organizer.

TIMEZONE RULES:
- Always extract the timezone shown in the image and put it in the "timezone" field.
- Return startTime and endTime as ISO 8601 strings in that detected timezone (e.g., "2026-03-23T15:00:00").
- Do NOT convert yourself — the server will convert to Eastern Time.

Extract all meeting information and return it as a JSON object with these fields:
- title: The actual meeting/event name (NOT including the attendee's name if it's a booking title format)
- description: Brief description of the meeting purpose or agenda
- startTime: ISO 8601 datetime string in the detected timezone (e.g., "2026-03-23T15:00:00"). Be precise with AM/PM.
- endTime: ISO 8601 datetime string if visible
- timezone: IANA timezone string if mentioned (e.g., "America/New_York", "America/Los_Angeles", "America/Chicago"). Map common abbreviations: EST/ET → "America/New_York", PST/PT → "America/Los_Angeles", CST/CT → "America/Chicago", MST/MT → "America/Denver".
- location: Physical address or virtual platform name
- organizer: The HOST or ORGANIZER of the meeting — the person running it, NOT the attendee
- meetingUrl: Any join link, meeting URL, or video call link visible
- notes: Any description, agenda, or additional context text from the image
- confidence: A number 0-1 indicating how confident you are in the extraction

Return ONLY a valid JSON object. Use null for fields you cannot determine.
Today's date for reference: ${new Date().toISOString().split('T')[0]}`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: "text",
              text: "Please extract all meeting details from this image and return them as a JSON object.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let extracted: Record<string, unknown> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
    }

    const sourceTz = (extracted.timezone as string) ?? null;

    // Convert startTime and endTime to EST
    const startTimeEST = convertToEST(extracted.startTime as string | null, sourceTz);
    const endTimeEST = convertToEST(extracted.endTime as string | null, sourceTz);

    // Log conversion for visibility
    if (sourceTz && sourceTz !== APP_TZ) {
      console.log(`Converted from ${sourceTz} to EST: ${extracted.startTime} → ${startTimeEST}`);
    }

    res.json({
      title: extracted.title ?? null,
      description: extracted.description ?? null,
      startTime: startTimeEST,
      endTime: endTimeEST,
      timezone: APP_TZ, // always save as EST
      location: extracted.location ?? null,
      organizer: extracted.organizer ?? null,
      meetingUrl: extracted.meetingUrl ?? null,
      notes: extracted.notes ?? null,
      confidence: extracted.confidence ?? null,
    });
  } catch (err) {
    console.error("AI extraction error:", err);
    res.status(500).json({ error: "Failed to extract meeting details" });
  }
});

export default router;
