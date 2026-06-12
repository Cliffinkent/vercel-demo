"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExtractionResult } from "@/lib/extractSchoolComms";
import { normalizeAppState, readState, writeState } from "./storage";
import type { AppState, SourceMessage, StoredTask } from "./types";

type Props = {
  demoMode: boolean;
};

const forwardingAddress = "family-demo@schoolrun-os.app";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeForwarded(state: AppState, extraction: ExtractionResult, message: SourceMessage) {
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
    sources: [message, ...state.sources].slice(0, 8),
  });
}

export function SetupForwarding({ demoMode }: Props) {
  const [status, setStatus] = useState("");
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(readState());
  }, []);

  async function runTest() {
    const current = state ?? readState();
    setStatus("Sending fake Gmail-style payload...");
    const response = await fetch("/api/inbound-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(current.profile ? { childProfile: current.profile } : {}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error || "Forwarding test failed.");
      return;
    }

    const next = mergeForwarded(current, payload.extraction, {
      id: uid("source"),
      sourceType: "forwarded_email",
      subject: payload.message.subject,
      sender: payload.message.sender,
      rawText: payload.message.rawText,
      processedAt: new Date().toISOString(),
      confidence: payload.extraction.overallConfidence,
    });
    setState(writeState(next));
    setStatus("Forwarded email processed. Open the dashboard to see the updated plan.");
  }

  return (
    <main className="shell setup-shell">
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

      <section className="setup-grid">
        <div className="intro-panel">
          <div className="status-row">
            {demoMode ? <span className="demo-pill">Demo mode</span> : null}
            <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
          </div>
          <h1>Forward school emails into the same extraction pipeline.</h1>
          <p>
            In production this would be your private inbound address. For the MVP, this page sends a
            fake Gmail-style payload into <code>/api/inbound-email</code>.
          </p>
          <div className="forwarding-address">
            <span>{forwardingAddress}</span>
            <button
              className="icon-button"
              aria-label="Copy forwarding address"
              onClick={() => navigator.clipboard.writeText(forwardingAddress)}
            >
              <Copy size={17} />
            </button>
          </div>
          <div className="setup-actions">
            <button className="primary-button" onClick={runTest}>
              <Send size={18} /> Run test forwarded email
            </button>
            <Link className="ghost-link" href="/dashboard">
              <ArrowLeft size={16} /> Back to dashboard
            </Link>
          </div>
          {status ? <p className="status-message">{status}</p> : null}
        </div>

        <div className="panel instructions-panel">
          <p className="section-label">Gmail setup</p>
          <h2>Filter and forwarding steps</h2>
          <ol className="step-list">
            <li>Open Gmail settings.</li>
            <li>Go to Filters and Blocked Addresses.</li>
            <li>Create a filter for the school sender or domain.</li>
            <li>Choose forward to your SchoolRun OS address.</li>
            <li>Confirm forwarding.</li>
            <li>Send a test email.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
