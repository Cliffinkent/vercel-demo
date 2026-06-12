"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Play, Send } from "lucide-react";
import { useState } from "react";
import { sampleMessages } from "@/lib/demoContent";
import { type SourceType } from "@/lib/extractSchoolComms";
import { dashboardFlashKey, mergeExtractionIntoState, readState, writeState } from "./storage";

type ProcessingMode = "pasted_email" | "newsletter" | "lunch_menu";

export function AddMessage() {
  const router = useRouter();
  const [rawText, setRawText] = useState<string>(sampleMessages.trip.text);
  const [mode, setMode] = useState<ProcessingMode>("pasted_email");
  const [selectedSampleKey, setSelectedSampleKey] = useState<keyof typeof sampleMessages>("trip");
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  function returnToDashboard(message: string) {
    window.sessionStorage.setItem(dashboardFlashKey, message);
    router.push("/dashboard");
  }

  async function processMessage(sourceType: SourceType = mode, text = rawText, subject = "Pasted school message") {
    if (!text.trim()) {
      setStatus("Paste a fake or redacted school message first.");
      return;
    }

    const current = readState();
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
          ...(current.profile ? { childProfile: current.profile } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Extraction failed.");

      const next = mergeExtractionIntoState(current, payload.extraction, {
        sourceType,
        subject,
        rawText: text,
      });
      writeState(next);
      returnToDashboard("Processed and added to the dashboard.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not process that message.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function runForwardedEmail() {
    const current = readState();
    setIsProcessing(true);
    setStatus("Sending a fake forwarded school email...");
    try {
      const response = await fetch("/api/inbound-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(current.profile ? { childProfile: current.profile } : {}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Forwarded email failed.");

      const next = mergeExtractionIntoState(current, payload.extraction, {
        sourceType: "forwarded_email",
        subject: payload.message.subject,
        sender: payload.message.sender,
        rawText: payload.message.rawText,
      });
      writeState(next);
      returnToDashboard("Forwarded email test added to the week.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not run the forwarding test.");
    } finally {
      setIsProcessing(false);
    }
  }

  function selectInputType(key: keyof typeof sampleMessages) {
    const sample = sampleMessages[key];
    setSelectedSampleKey(key);
    setRawText(sample.text);
    setMode(sample.sourceType as ProcessingMode);
    setStatus(`${sample.label} loaded.`);
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

      <section className="shell add-message-shell">
        <div className="add-message-heading">
          <Link className="ghost-button" href="/dashboard">
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
        </div>

        <section className="card source-panel add-message-card">
          <div className="card-header">
            <div>
              <p className="section-label">Add school message</p>
              <h1>Paste or test</h1>
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
          <p className="privacy-helper">For this demo, use fake or redacted school messages.</p>
          <textarea
            id="school-message"
            value={rawText}
            onChange={(event) => setRawText(event.target.value.slice(0, 12000))}
            maxLength={12000}
            rows={10}
          />
          <div className="source-actions">
            <button className="primary-button" onClick={() => processMessage()} disabled={isProcessing}>
              <Play size={18} /> Process message
            </button>
            <button className="ghost-button" onClick={runForwardedEmail} disabled={isProcessing}>
              <Send size={17} /> Run test forwarded email
            </button>
          </div>
          {status ? <p className="status-message add-message-status">{status}</p> : null}
        </section>
      </section>
    </main>
  );
}
