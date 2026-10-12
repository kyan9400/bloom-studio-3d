"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FINISHES, SHADES, type Finish } from "@/lib/shades";
import { studioStore, useStudio } from "@/lib/studio-store";

export default function ShadePicker() {
  const studio = useStudio();
  const id = useId();
  const finishNote = FINISHES.find((f) => f.id === studio.finish)?.note;
  const finishLabel = FINISHES.find((f) => f.id === studio.finish)?.label;
  const readout = `${capitalise(studio.name)}, ${finishLabel} · ${finishNote}`;

  // Screen readers hear the choice once the picking stops (a colour-input drag fires on every tick);
  // the visible readout below stays instant.
  const [announced, setAnnounced] = useState("");
  // the page-load value is never announced; after the first real change every value is
  const initial = useRef<string | null>(readout);
  useEffect(() => {
    if (readout === initial.current) return;
    initial.current = null;
    const t = window.setTimeout(() => setAnnounced(readout), 400);
    return () => window.clearTimeout(t);
  }, [readout]);

  return (
    <div className="picker">
      <fieldset className="picker-group">
        <legend className="picker-legend">Choose a shade</legend>
        <div className="shade-grid">
          {SHADES.map((s) => (
            <label key={s.id} className="shade-chip" title={s.name}>
              <input
                type="radio"
                name={`${id}-shade`}
                value={s.id}
                checked={studio.shadeId === s.id}
                onChange={() => studioStore.set({ shadeId: s.id, name: s.name, hex: s.hex })}
                className="sr-only"
              />
              <span className="shade-dot" style={{ background: s.hex }} aria-hidden="true" />
              <span className="sr-only">{s.name}</span>
            </label>
          ))}
          <label className="shade-chip shade-custom" title="Custom colour">
            <input
              type="color"
              value={studio.hex}
              onChange={(e) => studioStore.set({ shadeId: "custom", name: "your custom mix", hex: e.target.value })}
              className="shade-color-input"
              aria-label="Custom colour"
            />
            <span
              className="shade-dot shade-dot-custom"
              data-active={studio.shadeId === "custom" || undefined}
              aria-hidden="true"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="picker-group">
        <legend className="picker-legend">Finish</legend>
        <div className="finish-row">
          {FINISHES.map((f) => (
            <label key={f.id} className="finish-pill">
              <input
                type="radio"
                name={`${id}-finish`}
                value={f.id}
                checked={studio.finish === f.id}
                onChange={() => studioStore.set({ finish: f.id as Finish })}
                className="sr-only"
              />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="picker-readout">
        <span className="picker-readout-name">{capitalise(studio.name)}</span>
        <span className="picker-readout-note">
          {finishLabel} · {finishNote}
        </span>
      </p>
      <span className="sr-only" aria-live="polite">
        {announced}
      </span>
    </div>
  );
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
