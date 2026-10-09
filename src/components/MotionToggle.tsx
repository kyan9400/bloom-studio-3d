"use client";

import { setFullMotion, useMotion } from "@/lib/motion";

/** "Turn on full motion" / "Reduce motion". variant="hint" only renders while motion is reduced. */
export default function MotionToggle({ variant = "plain" }: { variant?: "plain" | "hint" }) {
  const { reduced } = useMotion();
  if (variant === "hint" && !reduced) return null;
  return (
    <button
      type="button"
      className={variant === "hint" ? "motion-hint" : "motion-link"}
      onClick={() => setFullMotion(reduced)}
    >
      {reduced ? "Turn on full motion" : "Reduce motion"}
    </button>
  );
}
