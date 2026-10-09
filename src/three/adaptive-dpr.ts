/*
  Gap-aware adaptive resolution (replaces drei's PerformanceMonitor).
  With frameloop="demand" the canvas often draws a single frame and then sleeps; a frame-rate monitor reads
  those gaps as "slow frames" and would drop the DPR for no reason. This controller is only fed deltas from
  consecutive frames of a running animation (the caller decides), ignores outliers, lowers the pixel ratio
  when frames get slow and raises it again after 2 s of headroom. A raise that has to be undone twice stops
  further raises, so the canvas never bounces between resolutions.
*/
export class AdaptiveDpr {
  private avg = 16.7;
  private settleUntil = 0;
  private calmSince = 0;
  private lastRaise = -1e9;
  private bounces = 0;
  private dpr: number;
  private readonly cap: number;
  private readonly apply: (dpr: number) => void;

  constructor(cap: number, apply: (dpr: number) => void) {
    this.cap = cap;
    this.apply = apply;
    this.dpr = cap;
  }

  private set(value: number, now: number) {
    this.dpr = value;
    this.apply(value);
    this.settleUntil = now + 700;
    this.calmSince = 0;
    this.avg = 16.7;
  }

  frame(deltaMs: number, now: number) {
    if (deltaMs < 4 || deltaMs > 100) return;
    this.avg += (deltaMs - this.avg) * 0.1;
    if (now < this.settleUntil) return;
    const floor = Math.min(1, this.cap) * 0.75;
    if (this.avg > 22 && this.dpr > floor) {
      if (now - this.lastRaise < 3000) this.bounces++;
      this.set(Math.max(floor, Math.min(this.dpr - 0.25, this.dpr * Math.sqrt(17.5 / this.avg))), now);
    } else if (this.avg < 17.8 && this.dpr < this.cap && this.bounces < 2) {
      if (!this.calmSince) this.calmSince = now;
      if (now - this.calmSince > 2000) {
        this.set(Math.min(this.cap, this.dpr + 0.25), now);
        this.lastRaise = now;
      }
    } else this.calmSince = 0;
  }
}
