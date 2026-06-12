"use client";

import type { ExtractionResult } from "@/lib/extractSchoolComms";
import { defaultProfile, sampleMessages } from "@/lib/demoContent";
import type { AppState, ChildProfile, SourceMessage, StoredTask } from "./types";

const key = "schoolrun-os-state";
export const dashboardFlashKey = "schoolrun-os-flash";

const priorityRank: Record<StoredTask["priority"], number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const noiseWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "can",
  "class",
  "for",
  "from",
  "if",
  "in",
  "is",
  "needed",
  "needs",
  "next",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "please",
  "reminder",
  "school",
  "should",
  "the",
  "this",
  "to",
  "will",
  "with",
  "you",
  "your",
]);

const dateWords = new Set([
  "mon",
  "monday",
  "tue",
  "tuesday",
  "wed",
  "wednesday",
  "thu",
  "thursday",
  "fri",
  "friday",
  "sat",
  "saturday",
  "sun",
  "sunday",
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
]);

type SourceInput = Omit<SourceMessage, "id" | "processedAt" | "confidence"> &
  Partial<Pick<SourceMessage, "id" | "processedAt" | "confidence">>;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function getStartOfWeekMonday(date: Date) {
  const start = localNoon(date);
  const day = start.getDay();
  const distanceFromMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + distanceFromMonday);
  return start;
}

function addDays(date: Date, days: number) {
  const next = localNoon(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isLegacyLunchEvent(event: AppState["events"][number]) {
  return event.category === "lunch" || event.title.toLowerCase().includes("lunch menu");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a3\s?\d+(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stemWord(word: string) {
  if (word === "kits") return "kit";
  if (word === "needed" || word === "needs") return "need";
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  return word;
}

function fingerprint(value: string) {
  return normalizeText(value)
    .split(" ")
    .map(stemWord)
    .filter((word) => word.length > 1 && !noiseWords.has(word))
    .join(" ");
}

function semanticTokens(value: string) {
  return new Set(
    fingerprint(value)
      .split(" ")
      .filter((word) => word && !dateWords.has(word) && !/^\d+$/.test(word)),
  );
}

function tokenCoverage(first: string, second: string) {
  const firstTokens = semanticTokens(first);
  const secondTokens = semanticTokens(second);
  const smallerSize = Math.min(firstTokens.size, secondTokens.size);
  if (smallerSize < 3) return 0;

  let shared = 0;
  firstTokens.forEach((token) => {
    if (secondTokens.has(token)) shared += 1;
  });

  return shared / smallerSize;
}

function categoryKey(category: string, title = "") {
  const value = `${category} ${title}`.toLowerCase();
  if (value.includes("non_uniform") || value.includes("non-uniform") || value.includes("non uniform")) {
    return "non_uniform";
  }
  if (value.includes("inset") || value.includes("closure") || value.includes("closed")) return "inset";
  if (value.includes("trip") || value.includes("museum") || value.includes("visit")) return "trip";
  if (value.includes("club")) return "club";
  if (/\bpe\b|\bphysical education\b|\bforest school\b/.test(value)) return "pe";
  if (value.includes("deadline") || value.includes("payment") || value.includes("pay") || value.includes("due")) {
    return "admin";
  }
  return normalizeText(category).replace(/\s+/g, "_") || "other";
}

function hasSameCost(first: string | null, second: string | null) {
  return !first || !second || normalizeText(first) === normalizeText(second);
}

function areDuplicateEvents(first: AppState["events"][number], second: AppState["events"][number]) {
  if ((first.date ?? "none") !== (second.date ?? "none")) return false;
  if (categoryKey(first.category, first.title) !== categoryKey(second.category, second.title)) return false;

  const firstTitle = fingerprint(first.title);
  const secondTitle = fingerprint(second.title);
  return firstTitle === secondTitle || tokenCoverage(first.title, second.title) >= 0.86;
}

function areDuplicateTasks(first: StoredTask, second: StoredTask) {
  const firstTitle = fingerprint(first.title);
  const secondTitle = fingerprint(second.title);
  if (firstTitle === secondTitle && hasSameCost(first.cost, second.cost)) return true;
  if ((first.dueDate ?? "none") !== (second.dueDate ?? "none")) return false;
  if (!hasSameCost(first.cost, second.cost)) return false;
  return tokenCoverage(first.title, second.title) >= 0.86;
}

function areDuplicateLunchItems(
  first: AppState["lunchMenu"][number],
  second: AppState["lunchMenu"][number],
) {
  return (first.date ?? "none") === (second.date ?? "none") && fingerprint(first.meal) === fingerprint(second.meal);
}

function sourceKey(source: SourceMessage) {
  return [source.sourceType, fingerprint(source.subject), fingerprint(source.rawText)].join("|");
}

function mergeEvent(
  existing: AppState["events"][number],
  incoming: AppState["events"][number],
): AppState["events"][number] {
  return {
    ...existing,
    date: existing.date ?? incoming.date,
    startTime: existing.startTime ?? incoming.startTime,
    endTime: existing.endTime ?? incoming.endTime,
    location: existing.location ?? incoming.location,
    description: existing.description ?? incoming.description,
    confidence: Math.max(existing.confidence, incoming.confidence),
  };
}

function mergeTask(existing: StoredTask, incoming: StoredTask): StoredTask {
  const priority = priorityRank[incoming.priority] > priorityRank[existing.priority] ? incoming.priority : existing.priority;

  return {
    ...existing,
    dueDate: existing.dueDate ?? incoming.dueDate,
    priority,
    cost: existing.cost ?? incoming.cost,
    notes: existing.notes ?? incoming.notes,
    confidence: Math.max(existing.confidence, incoming.confidence),
    status: existing.status === "done" || incoming.status === "done" ? "done" : "open",
  };
}

function mergeLunchItem(
  existing: AppState["lunchMenu"][number],
  incoming: AppState["lunchMenu"][number],
): AppState["lunchMenu"][number] {
  return {
    ...existing,
    allergens: existing.allergens ?? incoming.allergens,
    notes: existing.notes ?? incoming.notes,
  };
}

function dedupeWithMerge<T>(
  items: T[],
  isDuplicate: (existing: T, incoming: T) => boolean,
  merge: (existing: T, incoming: T) => T,
) {
  return items.reduce<T[]>((deduped, item) => {
    const existingIndex = deduped.findIndex((existing) => isDuplicate(existing, item));
    if (existingIndex === -1) return [...deduped, item];

    return deduped.map((existing, index) => (index === existingIndex ? merge(existing, item) : existing));
  }, []);
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const itemKey = getKey(item);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
}

export function filterWarnings(warnings: string[]) {
  return uniqueBy(warnings, (warning) => fingerprint(warning)).filter((warning) => {
    const missingDateSubject = /^Could not infer a date for event:\s*["“]([^"”]+)["”]\.?$/i.exec(warning)?.[1];
    return !missingDateSubject?.toLowerCase().includes("lunch menu");
  });
}

export function normalizeAppState(state: AppState): AppState {
  const events = dedupeWithMerge(
    (state.events ?? []).filter((event) => !isLegacyLunchEvent(event)),
    areDuplicateEvents,
    mergeEvent,
  );
  const tasks = dedupeWithMerge(state.tasks ?? [], areDuplicateTasks, mergeTask);
  const lunchMenu = dedupeWithMerge(state.lunchMenu ?? [], areDuplicateLunchItems, mergeLunchItem);
  const childNotes = uniqueBy(state.childNotes ?? [], (note) => `${note.childName ?? "none"}|${fingerprint(note.note)}`);
  const sources = uniqueBy(state.sources ?? [], sourceKey).slice(0, 8);

  return {
    ...state,
    events,
    tasks,
    lunchMenu,
    childNotes,
    warnings: filterWarnings(state.warnings ?? []),
    sources,
  };
}

export function mergeExtractionIntoState(
  state: AppState,
  extraction: ExtractionResult,
  source: SourceInput,
) {
  const tasks: StoredTask[] = extraction.tasks.map((task) => ({
    ...task,
    id: uid("task"),
    status: "open",
  }));

  return normalizeAppState({
    ...state,
    summary: extraction.summary,
    events: [...(state.events ?? []), ...extraction.events],
    tasks: [...(state.tasks ?? []), ...tasks],
    lunchMenu: [...(state.lunchMenu ?? []), ...extraction.lunchMenu],
    childNotes: [...(state.childNotes ?? []), ...extraction.childNotes],
    warnings: [...extraction.warnings, ...(state.warnings ?? [])].slice(0, 8),
    sources: [
      {
        ...source,
        id: source.id ?? uid("source"),
        processedAt: source.processedAt ?? new Date().toISOString(),
        confidence: source.confidence ?? extraction.overallConfidence,
      },
      ...(state.sources ?? []),
    ].slice(0, 8),
  });
}

export const initialState: AppState = {
  profile: null,
  summary: "Create Sam's profile, then paste a school message or run the forwarding test.",
  events: [],
  tasks: [],
  lunchMenu: [],
  childNotes: [],
  warnings: [],
  sources: [],
};

export function createSampleDashboardState(): AppState {
  const weekStart = getStartOfWeekMonday(new Date());
  const dates = Array.from({ length: 5 }, (_, index) => formatDateKey(addDays(weekStart, index)));
  const processedAt = new Date().toISOString();

  return normalizeAppState({
    profile: defaultProfile,
    summary: "Sam has a museum trip, PE kit reminder, club deadline and lunch menu items in this sample week.",
    events: [
      {
        title: "Science Museum trip",
        date: dates[1],
        startTime: "9:15am",
        endTime: null,
        location: "Science Museum",
        category: "trip",
        description: "Coach leaves Oakfield Primary at 9:15am and returns before pickup.",
        confidence: 0.92,
      },
      {
        title: "PE athletics practice",
        date: dates[2],
        startTime: null,
        endTime: null,
        location: null,
        category: "PE",
        description: "Bring trainers, water bottle and sun hat.",
        confidence: 0.86,
      },
      {
        title: "After-school club sign up closes",
        date: dates[3],
        startTime: null,
        endTime: null,
        location: null,
        category: "club",
        description: "After-school club sign up closes by Thursday.",
        confidence: 0.82,
      },
      {
        title: "Cake sale",
        date: dates[4],
        startTime: null,
        endTime: null,
        location: "School hall",
        category: "other",
        description: "Please bring nut-free cakes if you can.",
        confidence: 0.78,
      },
    ],
    tasks: [
      {
        id: "sample-task-permission",
        title: "Pay and return the museum trip permission form",
        dueDate: dates[0],
        priority: "high",
        cost: "£8.50",
        notes: "Permission form and payment due before the trip.",
        confidence: 0.92,
        status: "open",
      },
      {
        id: "sample-task-packed-lunch",
        title: "Pack a named lunch bag for the trip",
        dueDate: dates[1],
        priority: "medium",
        cost: null,
        notes: "Children should bring a packed lunch in a named bag.",
        confidence: 0.86,
        status: "open",
      },
      {
        id: "sample-task-pe-kit",
        title: "Bring PE kit and trainers",
        dueDate: dates[2],
        priority: "medium",
        cost: null,
        notes: "Athletics practice needs trainers, water bottle and sun hat.",
        confidence: 0.84,
        status: "open",
      },
      {
        id: "sample-task-club",
        title: "Sign up for after-school club",
        dueDate: dates[3],
        priority: "high",
        cost: null,
        notes: "Club sign up closes by Thursday.",
        confidence: 0.8,
        status: "open",
      },
    ],
    lunchMenu: [
      { date: dates[0], meal: "Tomato pasta bake", allergens: "wheat, milk", notes: null },
      { date: dates[1], meal: "Jacket potato with beans", allergens: "none listed", notes: null },
      { date: dates[2], meal: "Chicken curry with rice", allergens: "mustard", notes: null },
      { date: dates[3], meal: "Fish fingers and peas", allergens: "fish, wheat", notes: null },
      { date: dates[4], meal: "Vegetarian pizza", allergens: "wheat, milk", notes: null },
    ],
    childNotes: [
      {
        childName: defaultProfile.childName,
        note: "Sam's class needs PE kit for athletics practice.",
      },
    ],
    warnings: [],
    sources: [
      {
        id: "sample-source-trip",
        sourceType: "pasted_email",
        subject: sampleMessages.trip.label,
        sender: "office@oakfield-primary.example",
        rawText: sampleMessages.trip.text,
        processedAt,
        confidence: 0.92,
      },
      {
        id: "sample-source-newsletter",
        sourceType: "newsletter",
        subject: sampleMessages.newsletter.label,
        sender: "newsletter@oakfield-primary.example",
        rawText: sampleMessages.newsletter.text,
        processedAt,
        confidence: 0.82,
      },
      {
        id: "sample-source-lunch",
        sourceType: "lunch_menu",
        subject: sampleMessages.lunch.label,
        sender: "catering@oakfield-primary.example",
        rawText: sampleMessages.lunch.text,
        processedAt,
        confidence: 0.88,
      },
    ],
  });
}

export function readState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initialState;
    const stored = { ...initialState, ...JSON.parse(raw) };
    const parsed = normalizeAppState(stored);
    if (JSON.stringify(parsed) !== JSON.stringify(stored)) {
      writeState(parsed);
    }
    return parsed;
  } catch {
    return initialState;
  }
}

export function writeState(state: AppState) {
  const next = normalizeAppState(state);
  window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function saveProfile(profile: ChildProfile) {
  const next = { ...readState(), profile };
  return writeState(next);
}

export function ensureSampleDashboardState() {
  const state = readState();
  const hasDashboardData =
    Boolean(state.profile) ||
    state.events.length > 0 ||
    state.tasks.length > 0 ||
    state.lunchMenu.length > 0 ||
    state.sources.length > 0;

  return hasDashboardData ? state : writeState(createSampleDashboardState());
}
