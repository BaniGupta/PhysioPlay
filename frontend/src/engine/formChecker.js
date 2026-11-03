// "Is the body doing the movement the right way?" — simple, explainable rules that run
// every frame in the browser so the game can react instantly.
// (The ML model judges the whole rep afterwards, on the backend.)
// The words shown to the patient are in i18n: "cue.<issue>" and "mistake.<issue>".
//
// Two kinds of issue:
//   POSTURE (blocking) — the camera can't judge the exercise: not visible, wrong way round,
//                        wrong side or wrong arm. Reps are NOT counted until it is fixed.
//   FORM    (mistake)  — the exercise is being done, but with a compensation. The rep counts,
//                        the mistake is named and the form score goes down.

import { OTHER } from "../pose/angles.js";

export const POSTURE_ISSUES = ["not_visible", "turn_side", "face_camera", "wrong_side", "wrong_arm"];

const RULES = {
  elbow_flexion: (a) => [a.trunk > 12 && "trunk_lean", a.shoulder > 30 && "upper_arm_moved"],
  shoulder_abduction: (a, level) => [a.trunk > 10 && "trunk_lean", level > 0.4 && a.elbow < 145 && "elbow_bent"],
  shoulder_flexion: (a, level) => [a.trunk > 12 && "trunk_lean", level > 0.4 && a.elbow < 145 && "elbow_bent"],
  squat: (a) => [a.trunk > 50 && "chest_down"],
  sit_to_stand: () => [],                // leaning forward to stand up is normal
  knee_extension: (a) => [a.trunk > 25 && "trunk_lean"],
  side_bend: () => [],
};

export function formIssues(exerciseId, a, level) {
  return (RULES[exerciseId] || (() => []))(a, level).filter(Boolean);
}

// Body view thresholds (shoulder width / torso height in the picture).
const SIDE_MAX = 0.42;   // above this you are not side-on
const FRONT_MIN = 0.42;  // below this you are not facing the camera

/**
 * view  = { ratio, near, nearScore } (smoothed), from pose/angles.bodyView
 * other = angles of the other arm { shoulder } (front-view arm exercises)
 */
export function postureIssues({ cameraView, side, joints, view, mine, other }) {
  if (!view) return [];
  if (cameraView === "side") {
    if (view.ratio > SIDE_MAX) return ["turn_side"];
    if ((side === "left" || side === "right") && view.near !== side && Math.abs(view.nearScore) > 0.06) return ["wrong_side"];
  } else if (cameraView === "front") {
    if (view.ratio < FRONT_MIN) return ["face_camera"];
    if (joints === "arm" && other && mine && other.shoulder > 50 && mine.shoulder < 35) return ["wrong_arm"];
  }
  return [];
}

export { OTHER };

/** Keeps an issue only if it showed up in most of the last frames, so one noisy frame never flashes a warning. */
export class IssueFilter {
  constructor(size = 12, need = 7) { this.size = size; this.need = need; this.hist = []; }
  reset() { this.hist = []; }
  push(issues) {
    this.hist.push(issues);
    if (this.hist.length > this.size) this.hist.shift();
    const counts = {};
    this.hist.forEach((list) => list.forEach((i) => { counts[i] = (counts[i] || 0) + 1; }));
    const need = Math.min(this.need, this.hist.length);
    const stable = Object.keys(counts).filter((k) => counts[k] >= need);
    // posture issues first: they decide whether we can judge the movement at all
    return stable.sort((x, y) => (POSTURE_ISSUES.includes(y) ? 1 : 0) - (POSTURE_ISSUES.includes(x) ? 1 : 0));
  }
}

/** A rule counts for the whole rep if it showed up in at least 20% of its frames. */
export function repFlags(rep) {
  const counts = {};
  rep.frames.forEach((f) => f.issues.forEach((i) => { counts[i] = (counts[i] || 0) + 1; }));
  const flags = Object.keys(counts).filter((k) => !POSTURE_ISSUES.includes(k) && counts[k] / rep.frames.length >= 0.2);
  if (rep.duration < 1.1) flags.push("too_fast");
  if (rep.partial) flags.push("partial");
  return flags;
}
