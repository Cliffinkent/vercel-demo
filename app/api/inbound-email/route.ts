import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildDemoForwardedEmail, extractSchoolComms } from "@/lib/extractSchoolComms";
import { rateLimit } from "@/lib/rateLimit";
import { persistExtraction } from "@/lib/supabaseServer";

const ForwardedEmailSchema = z.object({
  messageId: z.string().max(240).optional(),
  from: z.string().max(240).optional(),
  to: z.string().max(240).optional(),
  subject: z.string().max(240).optional(),
  text: z.string().max(12000).optional(),
  childProfile: z
    .object({
      parentName: z.string().max(120).optional().nullable(),
      childName: z.string().max(120).optional().nullable(),
      childAge: z.number().int().min(0).max(18).optional().nullable(),
      schoolName: z.string().max(180).optional().nullable(),
      schoolWebsiteUrl: z.string().max(300).optional().nullable(),
    })
    .optional(),
});

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(`inbound:${clientKey(request)}`, 12);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many forwarded email tests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 60) } },
    );
  }

  try {
    const incoming = ForwardedEmailSchema.parse(await request.json().catch(() => ({})));
    const demo = buildDemoForwardedEmail();
    const payload = {
      ...demo,
      ...incoming,
      text: incoming.text || demo.text,
      subject: incoming.subject || demo.subject,
      from: incoming.from || demo.from,
    };

    const extraction = await extractSchoolComms({
      rawText: payload.text,
      sourceType: "forwarded_email",
      childProfile: incoming.childProfile,
    });

    const persistence = await persistExtraction({
      rawText: payload.text,
      sourceType: "forwarded_email",
      subject: payload.subject,
      sender: payload.from,
      childProfile: incoming.childProfile,
      extraction,
    });

    return NextResponse.json({
      message: {
        id: payload.messageId,
        subject: payload.subject,
        sender: payload.from,
        sourceType: "forwarded_email",
        rawText: payload.text,
      },
      extraction,
      ...persistence,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "The forwarded email payload was not valid for this demo." },
        { status: 400 },
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
    return NextResponse.json(
      { error: "SchoolRun OS could not process the forwarded email test." },
      { status: 500 },
    );
  }
}
