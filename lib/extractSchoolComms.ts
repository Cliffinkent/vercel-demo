import { z } from "zod";

export const SourceTypeSchema = z.enum([
  "pasted_email",
  "newsletter",
  "lunch_menu",
  "forwarded_email",
  "demo",
]);

export const ChildProfileSchema = z.object({
  parentName: z.string().trim().max(120).optional().nullable(),
  childName: z.string().trim().max(120).optional().nullable(),
  childAge: z.number().int().min(0).max(18).optional().nullable(),
  schoolName: z.string().trim().max(180).optional().nullable(),
  schoolWebsiteUrl: z.string().trim().max(300).optional().nullable(),
});

export const ExtractionRequestSchema = z.object({
  rawText: z.string().min(1).max(12000),
  sourceType: SourceTypeSchema,
  childProfile: ChildProfileSchema.optional(),
  currentDate: z.string().date().optional(),
});

export const ExtractedEventSchema = z.object({
  title: z.string(),
  date: z.string().date().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  location: z.string().nullable(),
  category: z.string(),
  description: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ExtractedTaskSchema = z.object({
  title: z.string(),
  dueDate: z.string().date().nullable(),
  priority: z.enum(["low", "medium", "high"]),
  cost: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const LunchMenuItemSchema = z.object({
  date: z.string().date().nullable(),
  meal: z.string(),
  allergens: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ExtractionResultSchema = z.object({
  summary: z.string(),
  events: z.array(ExtractedEventSchema),
  tasks: z.array(ExtractedTaskSchema),
  lunchMenu: z.array(LunchMenuItemSchema),
  childNotes: z.array(
    z.object({
      childName: z.string().nullable(),
      note: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
  overallConfidence: z.number().min(0).max(1),
});

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type ChildProfile = z.infer<typeof ChildProfileSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

type ExtractArgs = {
  rawText: string;
  sourceType: SourceType;
  childProfile?: ChildProfile;
  currentDate?: string;
};

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const monthIndex: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const categoryPatterns: Array<[RegExp, string]> = [
  [/\btrip\b|\bmuseum\b|\bvisit\b/i, "trip"],
  [/\bpacked lunch\b/i, "trip"],
  [/\bPE\b|\bphysical education\b/i, "PE"],
  [/\bnon-uniform\b|\bnon uniform\b/i, "non_uniform"],
  [/\binset\b/i, "inset"],
  [/\bclub\b/i, "club"],
  [/\bdeadline\b|\bpayment\b|\bpay by\b/i, "deadline"],
  [/\bcake sale\b/i, "other"],
];

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function noon(dateString?: string) {
  const base = dateString ? new Date(`${dateString}T12:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  return base;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveWeekday(text: string, currentDate: string, warnings: string[]) {
  const lowered = text.toLowerCase();
  const today = noon(currentDate);
  for (const [index, day] of weekdays.entries()) {
    const sameWeekMatch = new RegExp(`\\b(this\\s+)?${day}\\b`, "i").exec(lowered);
    const nextWeekMatch = new RegExp(`\\bnext\\s+${day}\\b`, "i").exec(lowered);
    if (!sameWeekMatch && !nextWeekMatch) continue;

    const currentDow = today.getUTCDay();
    let delta = index - currentDow;
    if (nextWeekMatch || delta <= 0) delta += 7;
    return iso(addDays(today, delta));
  }

  if (/\btomorrow\b/i.test(text)) return iso(addDays(today, 1));
  if (/\btoday\b/i.test(text)) return iso(today);
  if (/\bnext week\b/i.test(text)) {
    warnings.push("Mentioned next week without a specific day, so the date is null.");
  }
  return null;
}

function resolveExplicitDate(text: string, currentDate: string) {
  const base = noon(currentDate);
  const dateLike = /\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?(?:\s*,?\s*(20\d{2}))?\b/i.exec(
    text,
  );
  if (!dateLike) return null;

  const firstDay = dateLike[1] ? Number(dateLike[1]) : null;
  const secondDay = dateLike[3] ? Number(dateLike[3]) : null;
  const day = firstDay ?? secondDay;
  if (!day) return null;

  const month = monthIndex[dateLike[2].toLowerCase()];
  let year = dateLike[4] ? Number(dateLike[4]) : base.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, month, day, 12));
  if (!dateLike[4] && candidate < addDays(base, -7)) {
    year += 1;
    candidate = new Date(Date.UTC(year, month, day, 12));
  }
  return iso(candidate);
}

function resolveDate(text: string, currentDate: string, warnings: string[]) {
  return resolveExplicitDate(text, currentDate) ?? resolveWeekday(text, currentDate, warnings);
}

function extractCost(text: string) {
  return /(?:£|\$)\s?\d+(?:\.\d{2})?/i.exec(text)?.[0].replace(/\s+/g, "") ?? null;
}

function extractTime(text: string) {
  return /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.exec(text)?.[0] ?? null;
}

function splitLines(text: string) {
  return text
    .split(/\r?\n|(?<=\.)\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLunchMenuLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function categoryFor(line: string) {
  return categoryPatterns.find(([pattern]) => pattern.test(line))?.[1] ?? "other";
}

function hasLunchMenuSignal(line: string) {
  return /\b(allergen|contains|menu|school lunch|vegetarian|fish|pasta|jacket potato|curry|pizza|beans|chicken|rice|peas|roast|sandwich|soup|salad)\b/i.test(
    line,
  );
}

function isLunchMenuHeader(line: string) {
  return /^(?:week\s+\d+\s+)?(?:school\s+)?lunch\s+menu:?$/i.test(line.trim());
}

function isRealSchoolEventLine(line: string) {
  return /\b(trip|museum|visit|PE|physical education|non-uniform|non uniform|inset|club|deadline|payment|pay by|due|return|bring|packed lunch|permission|sign up|form|assembly|match|open afternoon|cake sale)\b/i.test(
    line,
  );
}

function hasDayOrDate(line: string, currentDate: string) {
  return Boolean(resolveExplicitDate(line, currentDate) || weekdays.some((day) => new RegExp(`\\b${day}\\b`, "i").test(line)));
}

function looksLikeLunchMenuLine(line: string, currentDate: string) {
  if (isLunchMenuHeader(line)) return true;
  if (hasLunchMenuSignal(line)) return true;
  return hasDayOrDate(line, currentDate) && /:/.test(line);
}

function mealFromLine(line: string) {
  let meal = line.trim();
  if (/:/.test(meal)) {
    const [prefix, ...rest] = meal.split(":");
    if (
      /\b(menu|lunch|allergen)\b/i.test(prefix) ||
      weekdays.some((day) => new RegExp(`\\b${day}\\b`, "i").test(prefix)) ||
      resolveExplicitDate(prefix, iso(new Date()))
    ) {
      meal = rest.join(":").trim();
    }
  }

  meal = meal
    .replace(/^(?:school\s+)?lunch\s+menu:?/i, "")
    .replace(/\s*[.;]?\s*\ballergens?:?\s*[^.;]+[.;]?/i, "")
    .replace(/\s*[.;]?\s*\bcontains:?\s*[^.;]+[.;]?/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]\s*$/, "");

  return concise(meal, "School lunch");
}

function lunchMenuItemFromLine(line: string, currentDate: string): ExtractionResult["lunchMenu"][number] | null {
  if (isLunchMenuHeader(line)) return null;
  const meal = mealFromLine(line);
  if (/^school lunch$/i.test(meal) || /^lunch menu$/i.test(meal)) return null;

  return {
    date: resolveDate(line, currentDate, []),
    meal,
    allergens: /allergens?:?\s*([^.;]+)/i.exec(line)?.[1]?.trim() ?? null,
    notes: /vegetarian/i.test(line) ? "Vegetarian option mentioned" : null,
  };
}

function extractLunchMenuItems(rawText: string, currentDate: string) {
  return splitLunchMenuLines(rawText)
    .filter((line) => !/^(subject|from|to|date):/i.test(line))
    .filter((line) => looksLikeLunchMenuLine(line, currentDate) && !isRealSchoolEventLine(line))
    .map((line) => lunchMenuItemFromLine(line, currentDate))
    .filter((item): item is ExtractionResult["lunchMenu"][number] => Boolean(item));
}

function lunchMenuKey(item: ExtractionResult["lunchMenu"][number]) {
  return `${item.date ?? "none"}|${item.meal.toLowerCase()}`;
}

function missingEventDateWarningSubject(warning: string) {
  if (!/^Could not infer a date for event:/i.test(warning)) return null;
  return /["“]([^"”]+)["”]/.exec(warning)?.[1] ?? "";
}

export function isCalendarEvent(item: Pick<ExtractionResult["events"][number], "category" | "title">) {
  const title = item.title.trim().toLowerCase();
  return item.category !== "lunch" && !title.includes("lunch menu");
}

function extractionSummary(
  events: ExtractionResult["events"],
  tasks: ExtractionResult["tasks"],
  lunchMenu: ExtractionResult["lunchMenu"],
) {
  return events.length || tasks.length || lunchMenu.length
    ? `Found ${events.length} calendar item${events.length === 1 ? "" : "s"}, ${tasks.length} parent action${tasks.length === 1 ? "" : "s"}, and ${lunchMenu.length} lunch menu note${lunchMenu.length === 1 ? "" : "s"}.`
    : "No clear school events or parent actions found.";
}

function normalizeExtractionResult(
  result: ExtractionResult,
  args: Required<Pick<ExtractArgs, "rawText" | "sourceType" | "currentDate">>,
): ExtractionResult {
  const existingLunchMenu = [...result.lunchMenu];
  const seenLunchMenu = new Set(existingLunchMenu.map(lunchMenuKey));
  if (args.sourceType === "lunch_menu") {
    for (const item of extractLunchMenuItems(args.rawText, args.currentDate)) {
      const key = lunchMenuKey(item);
      if (!seenLunchMenu.has(key)) {
        existingLunchMenu.push(item);
        seenLunchMenu.add(key);
      }
    }
  }

  const events = result.events.filter(isCalendarEvent);

  const warnings = result.warnings.filter((warning) => {
    const subject = missingEventDateWarningSubject(warning);
    if (subject === null) return true;
    return isRealSchoolEventLine(subject) && !subject.toLowerCase().includes("lunch menu");
  });

  return ExtractionResultSchema.parse({
    ...result,
    summary: extractionSummary(events, result.tasks, existingLunchMenu),
    events,
    lunchMenu: existingLunchMenu,
    warnings,
  });
}

function concise(line: string, fallback: string) {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 96 ? `${cleaned.slice(0, 93)}...` : cleaned;
}

function fallbackExtract(args: Required<Pick<ExtractArgs, "rawText" | "sourceType">> & Pick<ExtractArgs, "childProfile" | "currentDate">): ExtractionResult {
  const currentDate = args.currentDate ?? iso(new Date());
  const lines = args.sourceType === "lunch_menu" ? splitLunchMenuLines(args.rawText) : splitLines(args.rawText);
  const warnings: string[] = [];
  const events: ExtractionResult["events"] = [];
  const tasks: ExtractionResult["tasks"] = [];
  const lunchMenu: ExtractionResult["lunchMenu"] = [];
  const childNotes: ExtractionResult["childNotes"] = [];
  const childName = args.childProfile?.childName ?? null;

  for (const line of lines) {
    if (/^(subject|from|to|date):/i.test(line)) continue;

    const lowered = line.toLowerCase();
    const isLunchOnlyLine =
      args.sourceType === "lunch_menu" &&
      looksLikeLunchMenuLine(line, currentDate) &&
      !isRealSchoolEventLine(line);

    if (isLunchOnlyLine) {
      const lunchMenuItem = lunchMenuItemFromLine(line, currentDate);
      if (lunchMenuItem) lunchMenu.push(lunchMenuItem);
      continue;
    }

    const date = resolveDate(line, currentDate, warnings);
    const time = extractTime(line);
    const category = categoryFor(line);
    const looksLikeEvent =
      category !== "other" ||
      /\b(day|sale|assembly|match|visit|open afternoon|menu)\b/i.test(line);

    if (
      looksLikeEvent &&
      !/\b(cost|costs|pay|payment|deadline|due|return|bring|packed lunch|permission|sign up|form|forms)\b/i.test(
        lowered,
      )
    ) {
      const event = {
        title: concise(line, "School event"),
        date,
        startTime: time,
        endTime: null,
        location: /hall/i.test(line) ? "School hall" : null,
        category,
        description: line,
        confidence: date ? 0.74 : 0.52,
      };
      if (isCalendarEvent(event)) {
        events.push(event);
        if (!date) warnings.push(`Could not infer a date for event: "${concise(line, "event")}".`);
      }
    }

    if (/\b(pay|payment|deadline|due|return|bring|packed lunch|permission|sign up|form|cake)\b/i.test(line)) {
      const dueDate = resolveDate(line, currentDate, warnings);
      tasks.push({
        title: concise(line, "Parent action"),
        dueDate,
        priority: /\b(deadline|due|payment|permission|inset)\b/i.test(line) ? "high" : "medium",
        cost: extractCost(line),
        notes: line,
        confidence: dueDate || extractCost(line) ? 0.78 : 0.58,
      });
      if (!dueDate && /\b(deadline|due|by)\b/i.test(line)) {
        warnings.push(`Could not infer a due date for task: "${concise(line, "task")}".`);
      }
    }

    if (/\b(allergen|contains|menu|lunch|vegetarian|fish|pasta|jacket potato|curry)\b/i.test(line)) {
      const lunchMenuItem = lunchMenuItemFromLine(line, currentDate);
      if (lunchMenuItem) lunchMenu.push(lunchMenuItem);
    }

    if (childName && lowered.includes(childName.toLowerCase())) {
      childNotes.push({
        childName,
        note: concise(line, `${childName} note`),
      });
    }
  }

  const confidenceItems = [
    ...events.map((event) => event.confidence),
    ...tasks.map((task) => task.confidence),
  ];
  const overallConfidence = confidenceItems.length
    ? Number((confidenceItems.reduce((sum, value) => sum + value, 0) / confidenceItems.length).toFixed(2))
    : 0.45;

  return normalizeExtractionResult(ExtractionResultSchema.parse({
    summary: extractionSummary(events, tasks, lunchMenu),
    events,
    tasks,
    lunchMenu,
    childNotes,
    warnings,
    overallConfidence,
  }), {
    rawText: args.rawText,
    sourceType: args.sourceType,
    currentDate,
  });
}

function hasAiCredentials() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
}

export async function extractSchoolComms(input: ExtractArgs): Promise<ExtractionResult> {
  const args = ExtractionRequestSchema.parse({
    rawText: input.rawText,
    sourceType: input.sourceType,
    childProfile: input.childProfile,
    currentDate: input.currentDate ?? iso(new Date()),
  });

  if (!hasAiCredentials()) {
    return fallbackExtract(args);
  }

  try {
    const { generateText, Output } = await import("ai");
    const { output } = await generateText({
      model: process.env.SCHOOLRUN_AI_MODEL ?? "openai/gpt-5.4",
      output: Output.object({ schema: ExtractionResultSchema }),
      system:
        "You extract school communications for parents. Return only schema-valid structured data. Resolve relative dates from the provided current date. If unsure, use null and add a warning. Never invent dates, times, costs, school facts, child details, or policies.",
      prompt: [
        `Current date: ${args.currentDate}`,
        `Source type: ${args.sourceType}`,
        `Child profile: ${JSON.stringify(args.childProfile ?? {})}`,
        "Extract summary, events, tasks, lunch menu items, child notes, warnings, and confidence.",
        "Raw school message:",
        args.rawText,
      ].join("\n\n"),
    });

    return normalizeExtractionResult(ExtractionResultSchema.parse(output), {
      rawText: args.rawText,
      sourceType: args.sourceType,
      currentDate: args.currentDate ?? iso(new Date()),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("AI extraction failed; falling back to demo parser.", error);
    }
    const result = fallbackExtract(args);
    return {
      ...result,
      warnings: [
        ...result.warnings,
        "AI extraction was unavailable, so the demo parser produced this result.",
      ],
    };
  }
}

export function buildDemoForwardedEmail() {
  return {
    messageId: `demo-${Date.now()}`,
    from: "office@oakfield-primary.example",
    to: "family-demo@schoolrun-os.app",
    subject: "Year 3 trip, PE reminder and cake sale",
    text: [
      "Dear families,",
      "Year 3 will visit the Science Museum on Tuesday 17 June. The trip costs £8.50 and children need a packed lunch.",
      "Please pay £8.50 and return the permission form by Friday 13 June.",
      "PE kits are needed next Wednesday for athletics practice.",
      "Newsletter reminder: INSET day on Monday 23 June. Oakfield Primary will be closed to pupils.",
      "After-school club sign up closes by Thursday 19 June.",
      "Cake sale in the school hall on Friday 20 June. Please bring nut-free cakes if you can.",
    ].join("\n"),
  };
}
