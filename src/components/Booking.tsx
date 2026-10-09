"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ARTISTS, SERVICES } from "@/lib/content";
import { FINISHES } from "@/lib/shades";
import { useStudio } from "@/lib/studio-store";

const STEPS = ["Service", "Artist", "Day & time", "Your details"] as const;
const SLOTS = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00"];
const ANYONE = { id: "any", name: "Whoever is free first", role: "Fastest available chair" };

type Day = { key: string; weekday: string; date: string; long: string; saturday: boolean; index: number };

/** The next 10 opening days (the studio is closed Sunday and Monday). */
function nextOpenDays(from: Date): Day[] {
  const days: Day[] = [];
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  let index = 0;
  while (days.length < 10) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0 || wd === 1) continue;
    days.push({
      key: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      long: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
      saturday: wd === 6,
      index: index++,
    });
  }
  return days;
}

const slotTaken = (day: Day, slot: number) => (day.index * 3 + slot * 2) % 5 === 0;

export default function Booking() {
  const studio = useStudio();
  const uid = useId();
  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [artist, setArtist] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // move focus to the new step's heading, but never on first load
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus();
  }, [step, done]);

  const go = (next: number) => {
    moved.current = true;
    setError("");
    if (next === 2 && days.length === 0) setDays(nextOpenDays(new Date()));
    setStep(next);
  };

  const finishLabel = FINISHES.find((f) => f.id === studio.finish)?.label ?? "";
  const svc = SERVICES.find((s) => s.id === service);
  const art = artist === ANYONE.id ? ANYONE : ARTISTS.find((a) => a.id === artist);
  const day = days.find((d) => d.key === dayKey);

  const validate = (): string => {
    if (step === 0 && !service) return "Choose a service to continue.";
    if (step === 1 && !artist) return "Choose an artist, or let us pick the first free chair.";
    if (step === 2 && (!dayKey || !time)) return "Pick a day and a time.";
    if (step === 3) {
      if (name.trim().length < 2) return "Tell us your name.";
      if (!/^\+?[\d\s()-]{7,}$/.test(contact.trim()) && !/^\S+@\S+\.\S+$/.test(contact.trim()))
        return "Add a phone number or an email address so we can confirm.";
    }
    return "";
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (step < STEPS.length - 1) go(step + 1);
    else {
      moved.current = true;
      setDone(true);
    }
  };

  const reset = () => {
    moved.current = true;
    setService("");
    setArtist("");
    setDayKey("");
    setTime("");
    setNotes("");
    setError("");
    setStep(0);
    setDone(false);
  };

  const errorId = `${uid}-error`;

  if (done) {
    return (
      <div className="booking booking-done">
        <div className="booking-done-mark" aria-hidden="true" style={{ background: studio.hex }} />
        <h3 ref={headingRef} tabIndex={-1} className="booking-step-title">
          Your chair is pencilled in.
        </h3>
        <p>
          We&rsquo;ll message you within the hour to confirm <strong>{svc?.name}</strong> with{" "}
          <strong>{artist === ANYONE.id ? "the first free artist" : art?.name}</strong> on{" "}
          <strong>{day?.long}</strong> at <strong>{time}</strong>.
        </p>
        <p className="booking-shade">
          Shade: {studio.name} · {finishLabel}
        </p>
        <p className="booking-small">This is a concept studio, so no message will actually arrive.</p>
        <button type="button" className="btn btn-ghost" onClick={reset}>
          Book another
        </button>
      </div>
    );
  }

  return (
    <form className="booking" onSubmit={onSubmit} noValidate aria-describedby={error ? errorId : undefined}>
      <ol className="booking-progress">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
            <span className="booking-progress-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="booking-progress-label">{label}</span>
          </li>
        ))}
      </ol>

      <p className="booking-shade">
        <span className="booking-shade-dot" style={{ background: studio.hex }} aria-hidden="true" />
        Your shade: {studio.name} · {finishLabel}{" "}
        <a href="#lab" className="text-link">
          change
        </a>
      </p>

      <h3 ref={headingRef} tabIndex={-1} className="booking-step-title">
        <span className="sr-only">
          Step {step + 1} of {STEPS.length}:{" "}
        </span>
        {["What are we doing?", "Who would you like?", "When suits you?", "How do we reach you?"][step]}
      </h3>

      {step === 0 && (
        <fieldset className="choice-list">
          <legend className="sr-only">Service</legend>
          {SERVICES.filter((s) => !s.addOn).map((s) => (
            <label key={s.id} className="choice">
              <input type="radio" name={`${uid}-service`} value={s.id} checked={service === s.id} onChange={() => setService(s.id)} />
              <span className="choice-body">
                <span className="choice-title">{s.name}</span>
                <span className="choice-meta">
                  {s.duration} · {s.price}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {step === 1 && (
        <fieldset className="choice-list">
          <legend className="sr-only">Artist</legend>
          {[...ARTISTS, ANYONE].map((a) => (
            <label key={a.id} className="choice">
              <input type="radio" name={`${uid}-artist`} value={a.id} checked={artist === a.id} onChange={() => setArtist(a.id)} />
              <span className="choice-body">
                <span className="choice-title">{a.name}</span>
                <span className="choice-meta">{a.role}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {step === 2 && (
        <div className="daytime">
          <fieldset>
            <legend className="field-label">Day</legend>
            <div className="day-grid">
              {days.map((d) => (
                <label key={d.key} className="day-chip">
                  <input
                    type="radio"
                    name={`${uid}-day`}
                    value={d.key}
                    checked={dayKey === d.key}
                    onChange={() => {
                      setDayKey(d.key);
                      setTime("");
                    }}
                    className="sr-only"
                  />
                  <span className="day-chip-body">
                    <span className="day-chip-wd">{d.weekday}</span>
                    <span className="day-chip-date">{d.date}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {day && (
            <fieldset>
              <legend className="field-label">Time on {day.long}</legend>
              <div className="slot-grid">
                {SLOTS.filter((_, i) => !day.saturday || i < 5).map((slot, i) => {
                  const taken = slotTaken(day, i);
                  return (
                    <label key={slot} className="slot-chip" data-taken={taken || undefined}>
                      <input
                        type="radio"
                        name={`${uid}-time`}
                        value={slot}
                        checked={time === slot}
                        disabled={taken}
                        onChange={() => setTime(slot)}
                        className="sr-only"
                      />
                      <span>
                        {slot}
                        {taken && <span className="sr-only"> (taken)</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="fields">
          <div className="field">
            <label htmlFor={`${uid}-name`} className="field-label">
              Name
            </label>
            <input
              id={`${uid}-name`}
              className="input"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-contact`} className="field-label">
              Phone or email
            </label>
            <input
              id={`${uid}-contact`}
              className="input"
              autoComplete="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${uid}-notes`} className="field-label">
              Notes <span className="field-optional">(optional)</span>
            </label>
            <textarea
              id={`${uid}-notes`}
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="booking-summary">
            <p>
              {svc?.name} · {art?.name} · {day?.long} at {time}
            </p>
          </div>
        </div>
      )}

      <p id={errorId} className="booking-error" role="alert">
        {error}
      </p>

      <div className="booking-nav">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary">
          {step === STEPS.length - 1 ? "Request booking" : "Continue"}
        </button>
      </div>
    </form>
  );
}
