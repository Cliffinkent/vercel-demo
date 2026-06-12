import { createClient } from "@supabase/supabase-js";
import type { ChildProfile, ExtractionResult, SourceType } from "./extractSchoolComms";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function adminClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function persistExtraction(args: {
  rawText: string;
  sourceType: SourceType;
  subject?: string | null;
  sender?: string | null;
  childProfile?: ChildProfile;
  extraction: ExtractionResult;
}) {
  const supabase = adminClient();
  if (!supabase) return { persisted: false, demoMode: true };

  const childInsert = args.childProfile?.childName
    ? await supabase
        .from("children")
        .insert({
          parent_name: args.childProfile.parentName ?? null,
          child_name: args.childProfile.childName,
          child_age: args.childProfile.childAge ?? null,
          school_name: args.childProfile.schoolName ?? null,
          school_website_url: args.childProfile.schoolWebsiteUrl ?? null,
        })
        .select("id")
        .single()
    : { data: null, error: null };

  const childId = childInsert.data?.id ?? null;

  const messageInsert = await supabase
    .from("ingested_messages")
    .insert({
      child_id: childId,
      source_type: args.sourceType,
      subject: args.subject ?? null,
      sender: args.sender ?? null,
      raw_text: args.rawText,
      confidence: args.extraction.overallConfidence,
    })
    .select("id")
    .single();

  if (childInsert.error || messageInsert.error) {
    return {
      persisted: false,
      demoMode: false,
      error: "Supabase persistence failed, but extraction succeeded.",
    };
  }

  const messageId = messageInsert.data.id;

  const [eventsInsert, tasksInsert] = await Promise.all([
    args.extraction.events.length
      ? supabase.from("events").insert(
          args.extraction.events.map((event) => ({
            child_id: childId,
            message_id: messageId,
            title: event.title,
            date: event.date,
            start_time: event.startTime,
            end_time: event.endTime,
            location: event.location,
            category: event.category,
            description: event.description,
            confidence: event.confidence,
          })),
        )
      : Promise.resolve({ error: null }),
    args.extraction.tasks.length
      ? supabase.from("tasks").insert(
          args.extraction.tasks.map((task) => ({
            child_id: childId,
            message_id: messageId,
            title: task.title,
            due_date: task.dueDate,
            priority: task.priority,
            status: "open",
            cost: task.cost,
            notes: task.notes,
            confidence: task.confidence,
          })),
        )
      : Promise.resolve({ error: null }),
  ]);

  return {
    persisted: !eventsInsert.error && !tasksInsert.error,
    demoMode: false,
    error: eventsInsert.error || tasksInsert.error ? "Some extracted records were not stored." : null,
  };
}
