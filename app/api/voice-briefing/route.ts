import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

const BriefingSchema = z.object({
  text: z.string().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = rateLimit(`voice:${key}`, 6);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many voice briefing requests." }, { status: 429 });
  }

  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    return NextResponse.json(
      { error: "Voice briefing is disabled in this demo environment." },
      { status: 503 },
    );
  }

  try {
    const body = BriefingSchema.parse(await request.json());
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: body.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.75 },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Voice briefing could not be generated." }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Voice briefing request was invalid." }, { status: 400 });
  }
}
