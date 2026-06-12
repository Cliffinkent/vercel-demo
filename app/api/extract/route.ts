import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  extractSchoolComms,
  ExtractionRequestSchema,
  SourceTypeSchema,
} from "@/lib/extractSchoolComms";
import { rateLimit } from "@/lib/rateLimit";
import { persistExtraction } from "@/lib/supabaseServer";

const ApiRequestSchema = ExtractionRequestSchema.extend({
  subject: z.string().max(240).optional().nullable(),
  sender: z.string().max(240).optional().nullable(),
  sourceType: SourceTypeSchema,
});

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(`extract:${clientKey(request)}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many demo requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 60) } },
    );
  }

  try {
    const body = ApiRequestSchema.parse(await request.json());
    const extraction = await extractSchoolComms(body);
    const persistence = await persistExtraction({
      rawText: body.rawText,
      sourceType: body.sourceType,
      subject: body.subject,
      sender: body.sender,
      childProfile: body.childProfile,
      extraction,
    });

    return NextResponse.json({ extraction, ...persistence });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please provide a valid school message under 12,000 characters." },
        { status: 400 },
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    return NextResponse.json(
      { error: "SchoolRun OS could not process that message. Please try a shorter demo message." },
      { status: 500 },
    );
  }
}
