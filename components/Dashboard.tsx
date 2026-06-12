"use client";

import Link from "next/link";
import {
  Archive,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Mail,
  Mic,
  RotateCcw,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isCalendarEvent } from "@/lib/extractSchoolComms";
import { dashboardFlashKey, ensureSampleDashboardState, filterWarnings, initialState, writeState } from "./storage";
import type { AppState } from "./types";

type Props = {
  voiceEnabled: boolean;
};

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

export function Dashboard({ voiceEnabled }: Props) {
  const [state, setState] = useState<AppState>(initialState);
  const [status, setStatus] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeekMonday(new Date()));
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    const loaded = ensureSampleDashboardState();
    setState(loaded);

    const firstDatedItem = [
      ...loaded.events.filter(isCalendarEvent).map((event) => event.date),
      ...loaded.lunchMenu.map((item) => item.date),
      ...loaded.tasks.map((task) => task.dueDate),
    ]
      .filter((date): date is string => Boolean(date))
      .sort()[0];

    if (firstDatedItem) {
      setSelectedWeekStart(getStartOfWeekMonday(new Date(`${firstDatedItem}T12:00:00`)));
    }

    const flash = window.sessionStorage.getItem(dashboardFlashKey);
    if (flash) {
      setStatus(flash);
      window.sessionStorage.removeItem(dashboardFlashKey);
    }
  }, []);

  function persist(next: AppState) {
    setState(writeState(next));
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
            <Link href="/dashboard">Dashboard</Link>
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
            <h1>{childName}&apos;s week</h1>
            <p>
              {weekLabel} · {schoolName}
            </p>
          </div>
          <div className="header-actions">
            <Link className="primary-button" href="/add-message">
              <Mail size={17} /> Add school message
            </Link>
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
                <p className="empty-text">Paste a lunch menu from Add school message to see meals here.</p>
              )}
            </div>
          </section>

          <section className={sourcesOpen ? "card source-summary-card open" : "card source-summary-card"}>
            <button
              aria-controls="recent-sources-list"
              aria-expanded={sourcesOpen}
              className="source-summary-toggle"
              onClick={() => setSourcesOpen((current) => !current)}
              type="button"
            >
              <span>
                <strong>Recent sources</strong>
              </span>
              <span className="source-toggle-meta">
                <span>
                  {state.sources.length} {state.sources.length === 1 ? "source" : "sources"}
                </span>
                {sourcesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>
            {sourcesOpen ? (
              <div className="source-list compact-source-list" id="recent-sources-list">
                {state.sources.length ? (
                  state.sources.map((source) => (
                    <details className="source-row" key={source.id}>
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
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
