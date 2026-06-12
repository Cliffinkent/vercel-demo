"use client";

import type { AppState, ChildProfile } from "./types";

const key = "schoolrun-os-state";

function isLegacyLunchEvent(event: AppState["events"][number]) {
  return event.category === "lunch" || event.title.toLowerCase().includes("lunch menu");
}

export function filterWarnings(warnings: string[]) {
  return warnings.filter((warning) => {
    const missingDateSubject = /^Could not infer a date for event:\s*["“]([^"”]+)["”]\.?$/i.exec(warning)?.[1];
    return !missingDateSubject?.toLowerCase().includes("lunch menu");
  });
}

export function normalizeAppState(state: AppState): AppState {
  return {
    ...state,
    events: (state.events ?? []).filter((event) => !isLegacyLunchEvent(event)),
    warnings: filterWarnings(state.warnings ?? []),
  };
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

export function readState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initialState;
    const stored = { ...initialState, ...JSON.parse(raw) };
    const parsed = normalizeAppState(stored);
    if (parsed.events.length !== stored.events.length || parsed.warnings.length !== stored.warnings.length) {
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
