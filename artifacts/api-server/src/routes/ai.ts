import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ExtractMeetingFromImageBody } from "@workspace/api-zod";

const router: IRouter = Router();

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
          content: `You are an AI assistant that extracts meeting details from screenshots and images. 
Extract all meeting information visible in the image and return it as a JSON object with these fields:
- title: The meeting name/title
- description: Brief description of the meeting purpose
- startTime: ISO 8601 datetime string (e.g., "2026-03-23T15:00:00")
- endTime: ISO 8601 datetime string if visible
- timezone: Timezone string if mentioned (e.g., "America/New_York", "Eastern Time")
- location: Physical or virtual location/platform
- organizer: Name of the meeting organizer or host
- meetingUrl: Any meeting link or URL visible
- notes: Any additional notes or meeting description
- confidence: A number 0-1 indicating how confident you are in the extraction

Return ONLY a valid JSON object with these fields. Use null for any fields you cannot determine.
For dates and times, use today's reference date as ${new Date().toISOString().split('T')[0]} to disambiguate year if not specified.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
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
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
    }

    res.json({
      title: extracted.title ?? null,
      description: extracted.description ?? null,
      startTime: extracted.startTime ?? null,
      endTime: extracted.endTime ?? null,
      timezone: extracted.timezone ?? null,
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
