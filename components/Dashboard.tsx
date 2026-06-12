"use client";

import Link from "next/link";
import {
  Archive,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mail,
  Mic,
  Play,
  RotateCcw,
  Send,
  Upload,
  Utensils,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { sampleMessages } from "@/lib/demoContent";
import { isCalendarEvent, type SourceType } from "@/lib/extractSchoolComms";
import { filterWarnings, initialState, mergeExtractionIntoState, readState, writeState } from "./storage";
import type { AppState } from "./types";

type Props = {
  demoMode: boolean;
  voiceEnabled: boolean;
};

type ProcessingMode = "pasted_email" | "newsletter" | "lunch_menu";

const sourceLabels: Record<string, string> = {
  pasted_email: "Pasted email",
  newsletter: "Newsletter",
  lunch_menu: "Lunch menu",
  forwarded_email: "Forwarded email",
  demo: "Demo",
};

const categoryLabels: Record<string, string> = {
  pe: "PE",
  trip: "Trip",
  club: "Club",
  nonUniform: "Non-uniform",
  inset: "INSET / closure",
  admin: "Admin",
  other: "Other",
};

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

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function visibleWeekDays(weekStart: Date) {
  const todayIso = formatDateKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const iso = formatDateKey(date);

    return {
      iso,
      dayName: new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date),
      dateNumber: new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(date),
      monthName: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      isToday: iso === todayIso,
    };
  });
}

function formatWeekLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

function formatFriendlyDate(dateString: string | null | undefined, fallback = "No due date") {
  if (!dateString) return fallback;
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function categoryTone(category: string, title = "") {
  const value = `${category} ${title}`.toLowerCase();
  if (value.includes("non_uniform") || value.includes("non-uniform") || value.includes("non uniform")) return "nonUniform";
  if (value.includes("inset") || value.includes("closure") || value.includes("closed")) return "inset";
  if (value.includes("trip") || value.includes("museum") || value.includes("visit")) return "trip";
  if (value.includes("club")) return "club";
  if (value.includes("pe") || value.includes("physical education") || value.includes("forest school")) return "pe";
  if (value.includes("deadline") || value.includes("payment") || value.includes("pay") || value.includes("due")) return "admin";
  return "other";
}

export function Dashboard({ demoMode, voiceEnabled }: Props) {
  const [state, setState] = useState<AppState>(initialState);
  const [rawText, setRawText] = useState<string>(sampleMessages.trip.text);
  const [mode, setMode] = useState<ProcessingMode>("pasted_email");
  const [selectedSampleKey, setSelectedSampleKey] = useState<keyof typeof sampleMessages>("trip");
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeekMonday(new Date()));

  useEffect(() => {
    setState(readState());
  }, []);

  function persist(next: AppState) {
    setState(writeState(next));
  }

  async function processMessage(sourceType: SourceType = mode, text = rawText, subject = "Pasted school message") {
    if (!text.trim()) {
      setStatus("Paste a fake or redacted school message first.");
      return;
    }

    setIsProcessing(true);
    setStatus("Reading the school message...");
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rawText: text,
          sourceType,
          subject,
          ...(state.profile ? { childProfile: state.profile } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Extraction failed.");

      const next = mergeExtractionIntoState(state, payload.extraction, {
        sourceType,
        subject,
        rawText: text,
      });
      persist(next);
      setStatus(payload.demoMode ? "Processed in demo mode." : "Processed and stored.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not process that message.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function runForwardedEmail() {
    setIsProcessing(true);
    setStatus("Sending a fake forwarded school email...");
    try {
      const response = await fetch("/api/inbound-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state.profile ? { childProfile: state.profile } : {}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Forwarded email failed.");

      const next = mergeExtractionIntoState(state, payload.extraction, {
        sourceType: "forwarded_email",
        subject: payload.message.subject,
        sender: payload.message.sender,
        rawText: payload.message.rawText,
      });
      persist(next);
      setStatus("Forwarded email test added to the week.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run the forwarding test.");
    } finally {
      setIsProcessing(false);
    }
  }

  function toggleTask(id: string) {
    persist({
      ...state,
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, status: task.status === "open" ? "done" : "open" } : task,
      ),
    });
  }

  function archiveCompletedTasks() {
    persist({
      ...state,
      tasks: state.tasks.filter((task) => task.status !== "done"),
    });
    setStatus("Completed to-do items archived.");
  }

  function selectInputType(key: keyof typeof sampleMessages) {
    const sample = sampleMessages[key];
    setSelectedSampleKey(key);
    setRawText(sample.text);
    setMode(sample.sourceType as ProcessingMode);
    setStatus(`${sample.label} loaded.`);
  }

  async function loadLunchMenuFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSelectedSampleKey("lunch");
    setMode("lunch_menu");
    setRawText(text.slice(0, 12000));
    setStatus(`${file.name} loaded as a lunch menu.`);
    event.target.value = "";
  }

  async function playVoiceBriefing() {
    if (!voiceEnabled) return;
    setStatus("Creating voice briefing...");
    const text = `${state.summary} Open tasks: ${state.tasks
      .filter((task) => task.status === "open")
      .map((task) => task.title)
      .join(". ")}`;
    const response = await fetch("/api/voice-briefing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      setStatus("Voice briefing is not available right now.");
      return;
    }
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    await audio.play();
    setStatus("Voice briefing playing.");
  }

  const days = useMemo(() => visibleWeekDays(selectedWeekStart), [selectedWeekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(selectedWeekStart), [selectedWeekStart]);
  const visibleWarnings = filterWarnings(state.warnings);
  const completedTaskCount = state.tasks.filter((task) => task.status === "done").length;
  const childName = state.profile?.childName ?? "Sam";
  const schoolName = state.profile?.schoolName ?? "Oakfield Primary";
  const openTasks = [...state.tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="shell topbar-inner">
          <Link href="/" className="brand" aria-label="SchoolRun OS home">
            <span className="brand-mark">SR</span>
            <span>SchoolRun OS</span>
          </Link>
          <nav className="topnav" aria-label="Primary">
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/dashboard">Sample week</Link>
            <Link href="/setup-forwarding">Setup</Link>
          </nav>
          <Link className="primary-button nav-cta" href="/#setup">
            Set up SchoolRun OS
          </Link>
        </div>
      </header>

      <div className="shell dashboard-shell">
        <section className="dashboard-title-row">
          <div>
            <div className="status-row">
              {demoMode ? <span className="demo-pill">Demo mode</span> : null}
              <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
            </div>
            <h1>{childName}&apos;s week</h1>
            <p>
              {weekLabel} · {schoolName}
            </p>
          </div>
          <div className="header-actions">
            <button className="ghost-button" onClick={runForwardedEmail} disabled={isProcessing}>
              <Send size={17} /> Run test forwarded email
            </button>
            {voiceEnabled ? (
              <button className="ghost-button" onClick={playVoiceBriefing}>
                <Mic size={17} /> Voice briefing
              </button>
            ) : null}
          </div>
        </section>

        <section className="summary-band" aria-live="polite">
          <div>
            <p className="section-label">Week summary</p>
            <p>{state.summary}</p>
          </div>
          {status ? <span className="status-message">{status}</span> : null}
        </section>

        {visibleWarnings.length ? (
          <div className="warning-list">
            {visibleWarnings.map((warning, index) => (
              <span key={`${warning}-${index}`}>
                <AlertTriangle size={14} /> {warning}
              </span>
            ))}
          </div>
        ) : null}

        <section className="planning-grid" aria-label="Weekly planning">
          <section className="card calendar-card">
            <div className="card-header calendar-header">
              <div>
                <p className="section-label">Sample week</p>
                <h2>This week</h2>
              </div>
              <div className="week-controls" aria-label="Week navigation">
                <button
                  className="icon-text-button"
                  type="button"
                  onClick={() => setSelectedWeekStart((current) => addWeeks(current, -1))}
                >
                  <ChevronLeft size={16} /> Previous week
                </button>
                <button
                  className="icon-text-button"
                  type="button"
                  onClick={() => setSelectedWeekStart(getStartOfWeekMonday(new Date()))}
                >
                  <RotateCcw size={16} /> This week
                </button>
                <button
                  className="icon-text-button"
                  type="button"
                  onClick={() => setSelectedWeekStart((current) => addWeeks(current, 1))}
                >
                  Next week <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="week-list">
              {days.map((day) => {
                const events = state.events.filter((event) => event.date === day.iso && isCalendarEvent(event));
                return (
                  <article className={day.isToday ? "week-day today" : "week-day"} key={day.iso}>
                    <div className="week-day-date">
                      <span>{day.dayName}</span>
                      <strong>{day.dateNumber}</strong>
                      <small>{day.monthName}</small>
                      {day.isToday ? <em>Today</em> : null}
                    </div>
                    <div className="week-day-events">
                      {events.length ? (
                        events.map((event, index) => {
                          const tone = categoryTone(event.category, event.title);
                          return (
                            <span className={`event-chip event-chip-${tone}`} key={`${event.title}-${index}`}>
                              <span>{categoryLabels[tone]}</span>
                              <strong>{event.title}</strong>
                              {event.startTime ? <time>{event.startTime}</time> : null}
                            </span>
                          );
                        })
                      ) : (
                        <span className="empty-text">No school items yet.</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="legend" aria-label="Calendar categories">
              {(["pe", "trip", "club", "nonUniform", "inset", "admin", "other"] as const).map((tone) => (
                <span key={tone}>
                  <i className={`legend-dot legend-dot-${tone}`} />
                  {categoryLabels[tone]}
                </span>
              ))}
            </div>
          </section>

          <aside className="card task-card">
            <div className="card-header">
              <div>
                <p className="section-label">Parent actions</p>
                <h2>To pay, pack and remember</h2>
              </div>
              <ClipboardList size={21} />
            </div>
            <div className="task-list">
              {openTasks.length ? (
                openTasks.map((task) => (
                  <button
                    aria-pressed={task.status === "done"}
                    className={`task-row ${task.status}`}
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    type="button"
                  >
                    <span className="checkmark" aria-hidden="true">{task.status === "done" ? <Check size={14} /> : null}</span>
                    <span className="task-copy">
                      <strong>{task.title}</strong>
                      <small>
                        <span>{formatFriendlyDate(task.dueDate)}</span>
                        {task.cost ? <b>{task.cost}</b> : null}
                      </small>
                    </span>
                    <em className={`priority priority-${task.priority}`}>{task.priority}</em>
                  </button>
                ))
              ) : (
                <p className="empty-text">Tasks will appear after extraction.</p>
              )}
            </div>
            {completedTaskCount ? (
              <button className="small-button archive-button" type="button" onClick={archiveCompletedTasks}>
                <Archive size={14} /> Archive completed
              </button>
            ) : null}
          </aside>
        </section>

        <section className="secondary-grid">
          <section className="card lunch-card">
            <div className="card-header">
              <div>
                <p className="section-label">Lunch menu</p>
                <h2>Meals and allergens</h2>
              </div>
              <Utensils size={21} />
            </div>
            <div className="menu-list">
              {state.lunchMenu.length ? (
                state.lunchMenu.slice(-8).map((item, index) => (
                  <div className="menu-row" key={`${item.meal}-${index}`}>
                    <strong>{formatFriendlyDate(item.date, "Date unknown")}</strong>
                    <p>{item.meal}</p>
                    {item.allergens ? <small>Allergens: {item.allergens}</small> : null}
                  </div>
                ))
              ) : (
                <p className="empty-text">Paste or upload a lunch menu to see meals here.</p>
              )}
            </div>
          </section>

          <section className="card source-panel">
            <div className="card-header">
              <div>
                <p className="section-label">Add school message</p>
                <h2>Paste, upload or test</h2>
              </div>
              <Mail size={21} />
            </div>
            <div className="mode-tabs" role="group" aria-label="Input type">
              {Object.entries(sampleMessages).map(([key, sample]) => (
                <button
                  aria-pressed={selectedSampleKey === key}
                  className={selectedSampleKey === key ? "tab active" : "tab"}
                  key={key}
                  onClick={() => selectInputType(key as keyof typeof sampleMessages)}
                  type="button"
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <label className="textarea-label" htmlFor="school-message">
              School message or lunch menu
            </label>
            <textarea
              id="school-message"
              value={rawText}
              onChange={(event) => setRawText(event.target.value.slice(0, 12000))}
              maxLength={12000}
              rows={8}
            />
            <div className="source-actions">
              <button className="primary-button" onClick={() => processMessage()} disabled={isProcessing}>
                <Play size={18} /> Process message
              </button>
              <label className="ghost-button file-button">
                <Upload size={17} /> Upload lunch menu
                <input accept=".txt,.md,.csv" onChange={loadLunchMenuFile} type="file" />
              </label>
              <button className="ghost-button" onClick={runForwardedEmail} disabled={isProcessing}>
                <Send size={17} /> Run test forwarded email
              </button>
            </div>

            <div className="source-list">
              <p className="section-label">Recent sources</p>
              {state.sources.length ? (
                state.sources.map((source) => (
                  <details key={source.id}>
                    <summary>
                      <span>{source.subject}</span>
                      <small>{sourceLabels[source.sourceType] ?? source.sourceType}</small>
                    </summary>
                    <p>{source.rawText}</p>
                    <small>Confidence {Math.round(source.confidence * 100)}%</small>
                  </details>
                ))
              ) : (
                <p className="empty-text">Processed messages stay in this browser for the demo.</p>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
