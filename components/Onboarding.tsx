"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { defaultProfile } from "@/lib/demoContent";
import { readState, saveProfile } from "./storage";

type Props = {
  demoMode: boolean;
};

export function Onboarding({ demoMode }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(defaultProfile);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const state = readState();
    setHasProfile(Boolean(state.profile));
    if (state.profile) setForm(state.profile);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProfile({
      ...form,
      childAge: Number(form.childAge) || 0,
    });
    router.push("/dashboard");
  }

  return (
    <main className="shell landing-shell">
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

      <section className="onboarding-grid">
        <div className="intro-panel">
          <div className="status-row">
            {demoMode ? <span className="demo-pill">Demo mode</span> : null}
            <span className="privacy-copy">For this demo, use fake or redacted school messages.</span>
          </div>
          <h1>School emails in. Family plan out.</h1>
          <p>
            Turn school trips, newsletters, PE reminders and lunch menus into one calm weekly plan
            for the family.
          </p>
          <div className="feature-strip">
            <span>
              <Sparkles size={16} /> Structured extraction
            </span>
            <span>
              <CalendarDays size={16} /> Weekly calendar
            </span>
            <span>
              <ShieldCheck size={16} /> Fake data demo
            </span>
          </div>
        </div>

        <form className="panel profile-form" onSubmit={onSubmit}>
          <div>
            <p className="section-label">Family profile</p>
            <h2>{hasProfile ? "Update Sam's demo profile" : "Create your demo profile"}</h2>
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
          <button className="primary-button" type="submit">
            Open dashboard <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
