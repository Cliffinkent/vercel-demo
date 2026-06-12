"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Copy, Mail, Send, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { defaultProfile } from "@/lib/demoContent";
import { mergeExtractionIntoState, readState, saveProfile, writeState } from "./storage";

type Props = {
  demoMode: boolean;
};

const forwardingAddress = "family-demo@schoolrun-os.app";

export function Onboarding({ demoMode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(defaultProfile);
  const [hasProfile, setHasProfile] = useState(false);
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const state = readState();
    setHasProfile(Boolean(state.profile));
    if (state.profile) setForm(state.profile);
  }, []);

  function currentProfile() {
    return {
      ...form,
      childAge: Number(form.childAge) || 0,
    };
  }

  function persistProfile() {
    setHasProfile(true);
    return saveProfile(currentProfile());
  }

  function continueToStep(nextStep: number) {
    persistProfile();
    setStep(nextStep);
    setStatus("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      continueToStep(2);
      return;
    }
    if (step === 2) {
      continueToStep(3);
      return;
    }
    persistProfile();
    router.push("/dashboard");
  }

  async function runTest() {
    const current = persistProfile();
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
      writeState(next);
      setStatus("Test received. Your sample week is ready.");
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
            <Link href="#how-it-works">How it works</Link>
            <Link href="/dashboard">Sample week</Link>
            <Link href="/setup-forwarding">Setup</Link>
          </nav>
          <Link className="primary-button nav-cta" href="#setup">
            Set up SchoolRun OS
          </Link>
        </div>
      </header>

      <section className="shell hero-grid">
        <div className="hero-copy">
          <div className="status-row">
            {demoMode ? <span className="demo-pill">Demo mode</span> : null}
            <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
          </div>
          <p className="core-line">School emails in. Family plan out.</p>
          <h1>The school stuff, out of your head.</h1>
          <p className="lede">
            SchoolRun OS reads school emails, newsletters and menus, then gives you one calm week view and a tidy list
            of what to pay, pack and remember.
          </p>
          <div className="hero-actions">
            <Link className="primary-button large-button" href="#setup">
              Set up SchoolRun OS <ArrowRight size={18} />
            </Link>
            <Link className="ghost-button large-button" href="/dashboard">
              See a sample week
            </Link>
          </div>
          <div className="feature-strip" aria-label="SchoolRun OS highlights">
            <span>
              <CalendarDays size={16} /> One calm week
            </span>
            <span>
              <Check size={16} /> Pay, pack, remember
            </span>
            <span>
              <ShieldCheck size={16} /> Parent-first privacy
            </span>
          </div>
        </div>

        <form className="card onboarding-card" id="setup" onSubmit={onSubmit}>
          <div className="steps" aria-label="Setup progress">
            {[
              ["1", "Child profile"],
              ["2", "School website"],
              ["3", "Forwarding test"],
            ].map(([number, label]) => {
              const current = Number(number);
              return (
                <span className={step === current ? "step active" : step > current ? "step done" : "step"} key={number}>
                  <b>{number}</b>
                  <small>{label}</small>
                </span>
              );
            })}
          </div>

          {step === 1 ? (
            <section className="onboarding-panel">
              <div>
                <p className="section-label">Child profile</p>
                <h2>{hasProfile ? "Update your family setup" : "Start with your child"}</h2>
              </div>
              <label>
                Parent name
                <input
                  value={form.parentName}
                  onChange={(event) => setForm({ ...form, parentName: event.target.value })}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Child name
                <input
                  value={form.childName}
                  onChange={(event) => setForm({ ...form, childName: event.target.value })}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Child age
                <input
                  value={form.childAge}
                  onChange={(event) => setForm({ ...form, childAge: Number(event.target.value) })}
                  type="number"
                  min={0}
                  max={18}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Continue <ArrowRight size={18} />
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="onboarding-panel">
              <div>
                <p className="section-label">School website</p>
                <h2>Where should SchoolRun OS look?</h2>
              </div>
              <label>
                School name
                <input
                  value={form.schoolName}
                  onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
                  maxLength={180}
                  required
                />
              </label>
              <label>
                School website URL
                <input
                  value={form.schoolWebsiteUrl}
                  onChange={(event) => setForm({ ...form, schoolWebsiteUrl: event.target.value })}
                  maxLength={300}
                  type="url"
                  required
                />
              </label>
              <div className="card-actions">
                <button className="ghost-button" onClick={() => setStep(1)} type="button">
                  Back
                </button>
                <button className="primary-button" type="submit">
                  Continue <ArrowRight size={18} />
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="onboarding-panel">
              <div>
                <p className="section-label">Forwarding setup</p>
                <h2>Send school emails here</h2>
              </div>
              <div className="forwarding-address">
                <span>{forwardingAddress}</span>
                <button
                  className="icon-button"
                  aria-label="Copy forwarding address"
                  onClick={() => navigator.clipboard.writeText(forwardingAddress)}
                  type="button"
                >
                  <Copy size={17} />
                </button>
              </div>
              <div className="setup-note">
                <Mail size={18} />
                <p>Create a mail rule from your school sender, then forward matching messages to this address.</p>
              </div>
              <button className="ghost-button" disabled={isTesting} onClick={runTest} type="button">
                <Send size={17} /> Run test forwarded email
              </button>
              {status ? <p className="status-message">{status}</p> : null}
              <div className="card-actions">
                <button className="ghost-button" onClick={() => setStep(2)} type="button">
                  Back
                </button>
                <button className="primary-button" type="submit">
                  Open dashboard <ArrowRight size={18} />
                </button>
              </div>
            </section>
          ) : null}
        </form>
      </section>

      <section className="shell how-section" id="how-it-works">
        <div>
          <p className="section-label">How it works</p>
          <h2>From school noise to family plan</h2>
        </div>
        <div className="how-grid">
          <article>
            <span>1</span>
            <h3>School emails in</h3>
            <p>Paste a message, add a menu, or forward a test email.</p>
          </article>
          <article>
            <span>2</span>
            <h3>SchoolRun OS sorts it</h3>
            <p>Events, deadlines, costs and meals are separated into the right places.</p>
          </article>
          <article>
            <span>3</span>
            <h3>Family plan out</h3>
            <p>Your week shows what is happening, what to do, and what to pack.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
