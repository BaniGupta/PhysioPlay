// Run: node tests/pose.test.mjs   (checks the angle, posture and rep-counting logic with made-up skeletons)
import { toPoints, computeAngles, armAngles, bodyView, primaryValue, OTHER } from "../src/pose/angles.js";
import { postureIssues, formIssues, IssueFilter, repFlags } from "../src/engine/formChecker.js";
import { RepCounter } from "../src/engine/repCounter.js";

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };
const rad = (d) => (d * Math.PI) / 180;

// Build 33 image landmarks (0-1) + world landmarks. view: "front" | "side-left" | "side-right"
function pose({ view = "front", leftArm = 0, rightArm = 0, leftElbow = 180, rightElbow = 180, upperFwd = 0, lean = 0 }) {
  const L = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const Wd = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const set = (i, x, y, v = 0.95, z = 0) => { L[i] = { x, y, z, visibility: v }; Wd[i] = { x: x - 0.5, y: y - 0.5, z }; };
  const hipY = 0.62, shY = 0.32, ar = 4 / 3;
  const shift = Math.tan(rad(lean)) * (hipY - shY) / ar;
  if (view === "front") {
    // person's LEFT is on the picture's RIGHT
    set(11, 0.58 + shift, shY); set(12, 0.42 + shift, shY); set(23, 0.55, hipY); set(24, 0.45, hipY);
  } else {
    const near = view === "side-left" ? "left" : "right";
    const vN = 0.97, vF = 0.45;
    const zl = near === "left" ? -0.15 : 0.15, zr = -zl;
    set(11, 0.505 + shift, shY, near === "left" ? vN : vF, zl); set(12, 0.495 + shift, shY, near === "right" ? vN : vF, zr);
    set(23, 0.505, hipY, near === "left" ? vN : vF, zl); set(24, 0.495, hipY, near === "right" ? vN : vF, zr);
  }
  const arm = (sh, el, wr, raise, elbow, outward, fwd) => {
    const s = L[sh], len = 0.13;
    // upper arm: angle "raise" away from hanging down, in the picture plane
    const a = rad(raise + fwd);
    const ex = s.x + (Math.sin(a) * len * outward) / ar, ey = s.y + Math.cos(a) * len;
    set(el, ex, ey, s.visibility, s.z);
    const b = a + rad(180 - elbow) * (outward >= 0 ? 1 : -1) * -1;   // forearm bends forward/up
    set(wr, ex + (Math.sin(b) * len * outward) / ar, ey + Math.cos(b) * len, s.visibility, s.z);
  };
  const side = view === "front";
  arm(11, 13, 15, leftArm, leftElbow, side ? 1 : 1, upperFwd);
  arm(12, 14, 16, rightArm, rightElbow, side ? -1 : 1, 0);
  set(25, L[23].x, 0.8); set(26, L[24].x, 0.8); set(27, L[23].x, 0.95); set(28, L[24].x, 0.95);
  return { L, Wd };
}
const analyse = (p, side) => {
  const P = toPoints(p.L, 4 / 3);
  return { a: computeAngles(P, side), view: bodyView(P, p.Wd), other: armAngles(P, OTHER[side]) };
};

// 1. front view, left arm raised to the side 90°, straight
let r = analyse(pose({ view: "front", leftArm: 90 }), "left");
ok(Math.abs(r.a.shoulder - 90) < 10, `front: left shoulder ~90 (torso line is slightly slanted) (got ${r.a.shoulder.toFixed(1)})`);
ok(r.a.elbow > 170, `front: straight elbow reads straight (got ${r.a.elbow.toFixed(1)})`);
ok(postureIssues({ cameraView: "front", side: "left", joints: "arm", view: r.view, mine: r.a, other: r.other }).length === 0, "front: correct arm -> no posture issue");
ok(formIssues("shoulder_abduction", r.a, 0.6).length === 0, `front: straight arm -> no elbow_bent (ratio ${r.view.ratio.toFixed(2)})`);

// 2. wrong arm
r = analyse(pose({ view: "front", rightArm: 90 }), "left");
ok(postureIssues({ cameraView: "front", side: "left", joints: "arm", view: r.view, mine: r.a, other: r.other })[0] === "wrong_arm", "front: right arm used for a LEFT plan -> wrong_arm");

// 3. bent elbow during shoulder raise
r = analyse(pose({ view: "front", leftArm: 90, leftElbow: 120 }), "left");
ok(formIssues("shoulder_abduction", r.a, 0.6).includes("elbow_bent"), `front: bent elbow -> elbow_bent (elbow ${r.a.elbow.toFixed(0)})`);

// 4. trunk lean
r = analyse(pose({ view: "front", leftArm: 90, lean: 18 }), "left");
ok(formIssues("shoulder_abduction", r.a, 0.6).includes("trunk_lean"), `front: leaning 18° -> trunk_lean (trunk ${r.a.trunk.toFixed(1)})`);

// 5. side-view exercise while facing the camera
r = analyse(pose({ view: "front" }), "left");
ok(postureIssues({ cameraView: "side", side: "left", joints: "arm", view: r.view })[0] === "turn_side", "facing camera for a side exercise -> turn_side");

// 6. front exercise while standing side-on
r = analyse(pose({ view: "side-left" }), "left");
ok(postureIssues({ cameraView: "front", side: "left", joints: "arm", view: r.view, mine: r.a, other: r.other })[0] === "face_camera", `side-on for a front exercise -> face_camera (ratio ${r.view.ratio.toFixed(2)})`);

// 7. side view, right side towards camera but plan is LEFT
r = analyse(pose({ view: "side-right" }), "left");
ok(postureIssues({ cameraView: "side", side: "left", joints: "arm", view: r.view })[0] === "wrong_side", `right side facing camera for a LEFT plan -> wrong_side (near ${r.view.near})`);
r = analyse(pose({ view: "side-left" }), "left");
ok(postureIssues({ cameraView: "side", side: "left", joints: "arm", view: r.view }).length === 0, "left side facing camera for a LEFT plan -> ok");

// 8. elbow flexion from the side: elbow bent to 90 -> 90° moved; upper arm swinging forward -> mistake
r = analyse(pose({ view: "side-left", leftElbow: 90 }), "left");
ok(Math.abs(primaryValue("elbow_flexion", r.a) - 90) < 4, `side: elbow bend 90 -> moved ${primaryValue("elbow_flexion", r.a).toFixed(1)}°`);
ok(formIssues("elbow_flexion", r.a, 0.5).length === 0, "side: clean elbow bend -> no mistake");
r = analyse(pose({ view: "side-left", leftElbow: 90, upperFwd: 40 }), "left");
ok(formIssues("elbow_flexion", r.a, 0.5).includes("upper_arm_moved"), `side: upper arm swings 40° -> upper_arm_moved (shoulder ${r.a.shoulder.toFixed(0)})`);

// 9. rep counter follows the goal
function run(goal, peaks) {
  const c = new RepCounter(goal); const reps = []; let reached = 0; let t = 0;
  for (const pk of peaks) {
    for (let i = 0; i <= 60; i++) { const lv = pk * Math.sin((i / 60) * Math.PI); const r = c.update(lv, { elbow: 1 }, [], (t += 33)); if (r.reached) reached++; if (r.rep) reps.push(r.rep); }
    for (let i = 0; i < 10; i++) c.update(0, { elbow: 1 }, [], (t += 33));
  }
  return { reps, reached };
}
let res = run(0.5, [0.5, 0.48, 0.3, 0.1]);
ok(res.reps.length === 3 && res.reps.filter((x) => !x.partial).length === 2, `goal 0.5: two full reps + one partial, small wobble ignored (got ${res.reps.map((x) => (x.partial ? "partial" : "full")).join(",")})`);
ok(res.reached === 2, `goal 0.5: 'reached' fires once per full rep (got ${res.reached})`);
res = run(1, [0.5]);
ok(res.reps.length === 1 && res.reps[0].partial, "goal 1.0: reaching half way is only a partial rep");

// 10. issue filter ignores one-frame flickers
const f = new IssueFilter();
let st = [];
for (let i = 0; i < 12; i++) st = f.push(i === 5 ? ["elbow_bent"] : []);
ok(st.length === 0, "a single noisy frame never shows a warning");
for (let i = 0; i < 12; i++) st = f.push(["trunk_lean"]);
ok(st[0] === "trunk_lean", "a steady mistake is shown");

// 11. rep flags name the mistakes
const flags = repFlags({ frames: Array.from({ length: 20 }, (_, i) => ({ issues: i < 8 ? ["trunk_lean"] : [] })), duration: 0.9, partial: true });
ok(flags.includes("trunk_lean") && flags.includes("too_fast") && flags.includes("partial"), `rep flags: ${flags.join(", ")}`);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
