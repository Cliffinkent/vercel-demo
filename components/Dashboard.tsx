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
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sampleMessages } from "@/lib/demoContent";
import { isCalendarEvent, type ExtractionResult, type SourceType } from "@/lib/extractSchoolComms";
import { filterWarnings, initialState, normalizeAppState, readState, writeState } from "./storage";
import type { AppState, SourceMessage, StoredTask } from "./types";

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
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      iso: formatDateKey(date),
      label: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(date),
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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeExtraction(
  state: AppState,
  extraction: ExtractionResult,
  source: Omit<SourceMessage, "id" | "processedAt" | "confidence">,
) {
  const tasks: StoredTask[] = extraction.tasks.map((task) => ({
    ...task,
    id: uid("task"),
    status: "open",
  }));

  return normalizeAppState({
    ...state,
    summary: extraction.summary,
    events: [...state.events, ...extraction.events],
    tasks: [...state.tasks, ...tasks],
    lunchMenu: [...state.lunchMenu, ...extraction.lunchMenu],
    childNotes: [...state.childNotes, ...extraction.childNotes],
    warnings: [...extraction.warnings, ...state.warnings].slice(0, 8),
    sources: [
      {
        ...source,
        id: uid("source"),
        processedAt: new Date().toISOString(),
        confidence: extraction.overallConfidence,
      },
      ...state.sources,
    ].slice(0, 8),
  });
}

export function Dashboard({ demoMode, voiceEnabled }: Props) {
  const [state, setState] = useState<AppState>(initialState);
  const [rawText, setRawText] = useState<string>(sampleMessages.trip.text);
  const [mode, setMode] = useState<ProcessingMode>("pasted_email");
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
    setStatus("Extracting calendar and parent actions...");
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

      const next = mergeExtraction(state, payload.extraction, {
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
    setStatus("Posting a fake Gmail-style payload...");
    try {
      const response = await fetch("/api/inbound-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state.profile ? { childProfile: state.profile } : {}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Forwarded email failed.");

      const next = mergeExtraction(state, payload.extraction, {
        sourceType: "forwarded_email",
        subject: payload.message.subject,
        sender: payload.message.sender,
        rawText: payload.message.rawText,
      });
      persist(next);
      setStatus("Forwarded email test processed through the same extraction pipeline.");
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

  function loadSample(key: keyof typeof sampleMessages) {
    const sample = sampleMessages[key];
    setRawText(sample.text);
    setMode(sample.sourceType as ProcessingMode);
    setStatus(`${sample.label} loaded.`);
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
  const openTasks = [...state.tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });

  return (
    <main className="shell dashboard-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">SR</span>
          <span>SchoolRun OS</span>
        </Link>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/setup-forwarding">Forwarding</Link>
        </nav>
      </header>

      <section className="dashboard-header">
        <div>
          <div className="status-row">
            {demoMode ? <span className="demo-pill">Demo mode</span> : null}
            <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
          </div>
          <h1>Your school week at a glance</h1>
          <p>
            {state.profile
              ? `${state.profile.childName} at ${state.profile.schoolName}`
              : "No profile yet. Create Sam's demo profile from the home page."}
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

      <section className="dashboard-grid">
        <div className="left-stack">
          <div className="panel summary-panel">
            <p className="section-label">Summary</p>
            <h2>{state.summary}</h2>
            {status ? <p className="status-message">{status}</p> : null}
            {visibleWarnings.length ? (
              <div className="warning-list">
                {visibleWarnings.map((warning, index) => (
                  <span key={`${warning}-${index}`}>
                    <AlertTriangle size={14} /> {warning}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="calendar-toolbar">
            <div>
              <p className="section-label">Calendar</p>
              <h2>{weekLabel}</h2>
            </div>
            <div className="week-controls" aria-label="Week navigation">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedWeekStart((current) => addWeeks(current, -1))}
              >
                <ChevronLeft size={16} /> Previous week
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedWeekStart(getStartOfWeekMonday(new Date()))}
              >
                <RotateCcw size={16} /> This week
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setSelectedWeekStart((current) => addWeeks(current, 1))}
              >
                Next week <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <section className="calendar-grid" aria-label="Weekly calendar">
            {days.map((day) => {
              const events = state.events.filter((event) => event.date === day.iso && isCalendarEvent(event));
              return (
                <article className="day-card" key={day.iso}>
                  <div>
                    <p className="day-label">{day.label}</p>
                    <p className="day-date">{day.iso}</p>
                  </div>
                  <div className="event-list">
                    {events.length ? (
                      events.map((event, index) => (
                        <div className="event-row" key={`${event.title}-${index}`}>
                          <span className={`chip chip-${event.category}`}>{event.category}</span>
                          <strong>{event.title}</strong>
                          {event.startTime ? <small>{event.startTime}</small> : null}
                        </div>
                      ))
                    ) : (
                      <p className="empty-text">No school items yet.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <div className="panel source-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Source input</p>
                <h2>Paste school communication</h2>
              </div>
              <Mail size={20} />
            </div>
            <div className="mode-tabs" role="tablist" aria-label="Message type">
              {(["pasted_email", "newsletter", "lunch_menu"] as const).map((item) => (
                <button
                  className={mode === item ? "tab active" : "tab"}
                  key={item}
                  onClick={() => setMode(item)}
                  type="button"
                >
                  {sourceLabels[item]}
                </button>
              ))}
            </div>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value.slice(0, 12000))}
              maxLength={12000}
              rows={10}
            />
            <div className="sample-row">
              {Object.entries(sampleMessages).map(([key, sample]) => (
                <button className="small-button" key={key} onClick={() => loadSample(key as keyof typeof sampleMessages)}>
                  {sample.label}
                </button>
              ))}
            </div>
            <button className="primary-button" onClick={() => processMessage()} disabled={isProcessing}>
              <Play size={18} /> Process message
            </button>
          </div>
        </div>

        <aside className="right-stack">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Parent actions</p>
                <h2>To-do list</h2>
              </div>
              <div className="panel-heading-actions">
                {completedTaskCount ? (
                  <button className="small-button" type="button" onClick={archiveCompletedTasks}>
                    <Archive size={14} /> Archive completed
                  </button>
                ) : null}
                <ClipboardList size={20} />
              </div>
            </div>
            <div className="task-list">
              {openTasks.length ? (
                openTasks.map((task) => (
                  <button className={`task-row ${task.status}`} key={task.id} onClick={() => toggleTask(task.id)}>
                    <span className="checkmark">{task.status === "done" ? <Check size={14} /> : null}</span>
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.dueDate ? `Due ${task.dueDate}` : "No due date"}
                        {task.cost ? ` · ${task.cost}` : ""}
                      </small>
                    </span>
                    <em className={`priority priority-${task.priority}`}>{task.priority}</em>
                  </button>
                ))
              ) : (
                <p className="empty-text">Tasks will appear after extraction.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Lunch menu</p>
                <h2>Meals and allergens</h2>
              </div>
              <Utensils size={20} />
            </div>
            <div className="menu-list">
              {state.lunchMenu.length ? (
                state.lunchMenu.slice(-8).map((item, index) => (
                  <div className="menu-row" key={`${item.meal}-${index}`}>
                    <strong>{item.date ?? "Date unknown"}</strong>
                    <p>{item.meal}</p>
                    {item.allergens ? <small>Allergens: {item.allergens}</small> : null}
                  </div>
                ))
              ) : (
                <p className="empty-text">Paste a lunch menu to see meals here.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <p className="section-label">Source messages</p>
            <div className="source-list">
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
          </div>
        </aside>
      </section>
    </main>
  );
}
