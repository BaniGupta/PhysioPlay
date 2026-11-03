// Counts reps on the normalised level (0 = rest position, 1 = top of the game scale).
//
// The thresholds follow the patient's GOAL (where the balloon / target line is), not the top
// of the scale, so a patient whose goal is low still gets full reps:
//   start    = goal x 0.25  (leave the rest zone to begin a rep, come back below it to finish)
//   reach    = goal x 0.85  (counts as reaching the goal -> full rep)
//   partial  = goal x 0.5   (got half way -> partial rep)
// Two different lines for starting and finishing (hysteresis) so small wobbles never count.

export class RepCounter {
  constructor(goal = 1) {
    this.setGoal(goal);
    this.reset();
  }

  setGoal(goal) {
    const g = Math.max(0.2, Math.min(1, goal));
    this.goal = g;
    this.start = Math.max(0.07, Math.min(0.22, g * 0.25));
    this.up = g * 0.85;
    this.partial = g * 0.5;
  }

  reset() {
    this.state = "rest";       // rest | moving
    this.reached = false;
    this.frames = [];
    this.peak = 0;
    this.t0 = 0;
  }

  /** Call every frame. Returns { rep, reached } — rep is a finished rep or null, reached is true once per rep. */
  update(level, angles, issues, t) {
    let reachedNow = false;
    if (this.state === "rest") {
      if (level > this.start + 0.05) {
        this.state = "moving";
        this.frames = [];
        this.peak = level;
        this.reached = false;
        this.t0 = t;
      } else {
        return { rep: null, reached: false };
      }
    }

    this.frames.push({ ...angles, issues });
    this.peak = Math.max(this.peak, level);
    if (!this.reached && level >= this.up) { this.reached = true; reachedNow = true; }

    if (t - this.t0 > 20000) { this.reset(); return { rep: null, reached: false }; } // got stuck, start over

    if (level < this.start) {
      const duration = (t - this.t0) / 1000;
      const { frames, peak, reached } = this;
      this.reset();
      if (frames.length < 6 || duration < 0.6) return { rep: null, reached: false };   // noise
      if (reached) return { rep: { frames, duration, peak, partial: false }, reached: reachedNow };
      if (peak >= this.partial) return { rep: { frames, duration, peak, partial: true }, reached: reachedNow };
      return { rep: null, reached: false };
    }
    return { rep: null, reached: reachedNow };
  }

  /** Where in the rep the patient is, for the coaching text. */
  phase() {
    if (this.state === "rest") return "rest";
    return this.reached ? "back" : "up";
  }
}
