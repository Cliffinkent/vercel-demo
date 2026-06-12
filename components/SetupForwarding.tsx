"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { dashboardFlashKey, mergeExtractionIntoState, readState, writeState } from "./storage";
import type { AppState } from "./types";

const forwardingAddress = "family-demo@schoolrun-os.app";

export function SetupForwarding() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(readState());
  }, []);

  async function runTest() {
    const current = state ?? readState();
    setIsTesting(true);
    setStatus("Sending a fake forwarded school email...");
    try {
      const response = await fetch("/api/inbound-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(current.profile ? { childProfile: current.profile } : {}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Forwarding test failed.");

      const next = mergeExtractionIntoState(current, payload.extraction, {
        sourceType: "forwarded_email",
        subject: payload.message.subject,
        sender: payload.message.sender,
        rawText: payload.message.rawText,
      });
      setState(writeState(next));
      window.sessionStorage.setItem(dashboardFlashKey, "Forwarded email test added to the week.");
      router.push("/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Forwarding test failed.");
    } finally {
      setIsTesting(false);
    }
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
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/setup-forwarding">Setup</Link>
          </nav>
          <Link className="primary-button nav-cta" href="/#setup">
            Set up SchoolRun OS
          </Link>
        </div>
      </header>

      <section className="shell setup-grid">
        <div className="setup-copy">
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
            <button className="primary-button" disabled={isTesting} onClick={runTest}>
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
