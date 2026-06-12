"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { mergeExtractionIntoState, readState, writeState } from "./storage";
import type { AppState } from "./types";

type Props = {
  demoMode: boolean;
};

const forwardingAddress = "family-demo@schoolrun-os.app";

export function SetupForwarding({ demoMode }: Props) {
  const [status, setStatus] = useState("");
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(readState());
  }, []);

  async function runTest() {
    const current = state ?? readState();
    setStatus("Sending a fake forwarded school email...");
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

    const next = mergeExtractionIntoState(current, payload.extraction, {
      sourceType: "forwarded_email",
      subject: payload.message.subject,
      sender: payload.message.sender,
      rawText: payload.message.rawText,
    });
    setState(writeState(next));
    setStatus("Forwarded email processed. Open the dashboard to see the updated plan.");
  }

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

      <section className="shell setup-grid">
        <div className="setup-copy">
          <div className="status-row">
            {demoMode ? <span className="demo-pill">Demo mode</span> : null}
            <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
          </div>
          <p className="core-line">School emails in. Family plan out.</p>
          <h1>Set up forwarding for SchoolRun OS.</h1>
          <p className="lede">
            Forward school messages to your family address, then SchoolRun OS turns them into one calm week view.
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
            <Link className="ghost-button" href="/dashboard">
              <ArrowLeft size={16} /> Back to dashboard
            </Link>
          </div>
          {status ? <p className="status-message">{status}</p> : null}
        </div>

        <div className="card instructions-panel">
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
