// Bundled by esbuild with a fake camera (see run line at bottom of README). Drives the real SessionEngine
// with made-up MediaPipe frames and checks posture warnings and rep counting end to end.
import { SessionEngine } from "../src/engine/sessionEngine.js";
import { makePose } from "./fakePose.mjs";
import * as fake from "./fakeTracker.mjs";

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const ex = (id, view) => ({ id, camera_view: view, default_target: 90 });

function runScenario({ exercise, side, frames }) {
  const reps = [], issues = new Map(); let reaches = 0;
  const video = { videoWidth: 640, videoHeight: 480, currentTime: 0 };
  const eng = new SessionEngine({ exercise, side, source: "camera", video, canvas: null,
    onFrame: (f) => f.issues.forEach((i) => issues.set(i, (issues.get(i) || 0) + 1)),
    onRep: (r) => reps.push(r), onReach: () => reaches++ });
  eng.landmarker = {};
  eng.setRange(5, 120); eng.setGoal(90 / 115); eng.setPlaying(true);
  let t = 0;
  for (const p of frames) { fake.setNext(p); t += 33; video.currentTime += 0.033; eng._tick(t); }
  cancelAnimationFrame(eng.raf);
  return { reps, issues, reaches };
}
const wave = (n, fn) => { const out = []; for (let k = 0; k < n; k++) { for (let i = 0; i <= 60; i++) out.push(fn(Math.sin((i / 60) * Math.PI))); for (let i = 0; i < 15; i++) out.push(fn(0)); } return out; };

// elbow flexion, side view, correct side: 3 clean reps
let r = runScenario({ exercise: ex("elbow_flexion", "side"), side: "left",
  frames: wave(3, (s) => makePose({ view: "side-left", leftElbow: 175 - 95 * s })) });
ok(r.reps.length === 3 && r.reps.every((x) => !x.partial && x.flags.length === 0), `elbow side-left: 3 clean reps (got ${r.reps.length}, flags ${r.reps.map((x) => x.flags.join("+") || "-").join(",")})`);
ok(r.reaches === 3, `elbow side-left: 3 'reached' moments (got ${r.reaches})`);

// same movement but the RIGHT side faces the camera -> no reps, wrong_side warning
r = runScenario({ exercise: ex("elbow_flexion", "side"), side: "left",
  frames: wave(3, (s) => makePose({ view: "side-right", leftElbow: 175 - 95 * s })) });
ok(r.reps.length === 0 && r.issues.get("wrong_side") > 50, `elbow, wrong side to camera: 0 reps + wrong_side (${r.issues.get("wrong_side") || 0} frames)`);

// facing the camera for a side exercise -> turn_side, no reps
r = runScenario({ exercise: ex("elbow_flexion", "side"), side: "left",
  frames: wave(2, (s) => makePose({ view: "front", leftElbow: 175 - 95 * s })) });
ok(r.reps.length === 0 && r.issues.get("turn_side") > 50, `elbow, facing camera: 0 reps + turn_side`);

// elbow flexion with the upper arm swinging forward -> reps counted but mistake named
r = runScenario({ exercise: ex("elbow_flexion", "side"), side: "left",
  frames: wave(2, (s) => makePose({ view: "side-left", leftElbow: 175 - 95 * s, upperFwd: 45 * s })) });
ok(r.reps.length === 2 && r.reps.every((x) => x.flags.includes("upper_arm_moved")), `elbow with swinging upper arm: mistake named (${r.reps.map((x) => x.flags.join("+")).join(",")})`);

// shoulder abduction, front, LEFT plan, patient lifts the RIGHT arm -> wrong_arm, no reps
r = runScenario({ exercise: ex("shoulder_abduction", "front"), side: "left",
  frames: wave(2, (s) => makePose({ view: "front", rightArm: 100 * s })) });
ok(r.reps.length === 0 && r.issues.get("wrong_arm") > 30, `abduction with the wrong arm: 0 reps + wrong_arm (${r.issues.get("wrong_arm") || 0} frames)`);

// shoulder abduction, correct arm, straight elbow -> no elbow_bent warning at all
r = runScenario({ exercise: ex("shoulder_abduction", "front"), side: "left",
  frames: wave(3, (s) => makePose({ view: "front", leftArm: 5 + 100 * s })) });
ok(r.reps.length === 3 && !r.issues.get("elbow_bent"), `abduction, straight arm: 3 reps and never "keep elbow straight" (${r.issues.get("elbow_bent") || 0} frames)`);

// shoulder abduction with a bent elbow -> named
r = runScenario({ exercise: ex("shoulder_abduction", "front"), side: "left",
  frames: wave(2, (s) => makePose({ view: "front", leftArm: 5 + 100 * s, leftElbow: 180 - 60 * s })) });
ok(r.reps.length === 2 && r.reps.every((x) => x.flags.includes("elbow_bent")), `abduction, bent elbow: named (${r.reps.map((x) => x.flags.join("+")).join(",")})`);

// jittery landmarks (noise) on a still body -> no reps
r = runScenario({ exercise: ex("shoulder_abduction", "front"), side: "left",
  frames: Array.from({ length: 300 }, () => makePose({ view: "front", leftArm: 8, noise: 0.006 })) });
ok(r.reps.length === 0, `standing still with camera jitter: 0 reps (got ${r.reps.length})`);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
