// The real-time loop that runs for every new camera frame, entirely in the browser:
//
//   camera frame -> MediaPipe points -> joint angles (picture plane) -> One-Euro smoothing
//                -> posture check (right way round? right side? right arm?)
//                -> level (0..1) -> form rules -> rep counter -> game + HUD
//
// "Demo mode" replaces the camera with keyboard / mouse input so the game can be
// tested (and demoed) without a webcam.

import { getLandmarker, startCamera, stopCamera, detect } from "../pose/poseTracker";
import {
  toPoints, computeAngles, armAngles, bodyView, visibility, primaryValue, anglesFromPrimary,
  SKELETON, highlighted, OTHER,
} from "../pose/angles";
import { EXERCISES } from "../exercises";
import { RepCounter } from "./repCounter";
import { formIssues, postureIssues, IssueFilter, repFlags, POSTURE_ISSUES } from "./formChecker";

/** One-Euro filter: smooths jitter when still, follows quickly when moving. */
class OneEuro {
  constructor(minCutoff = 1.4, beta = 0.03, dCutoff = 1.0) {
    Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0 });
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(v, dt) {
    if (this.x === null) { this.x = v; return v; }
    const dv = (v - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dv - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}

export class SessionEngine {
  constructor({ exercise, side, source, video, canvas, onFrame, onRep, onReach }) {
    this.exercise = exercise;
    this.cfg = EXERCISES[exercise.id];
    this.side = side === "left" || side === "right" ? side : "right";
    this.planSide = side;
    this.source = source;            // "camera" | "demo"
    this.video = video;
    this.canvas = canvas;
    this.onFrame = onFrame;
    this.onRep = onRep;
    this.onReach = onReach;
    this.range = null;               // { min, max } in degrees moved
    this.playing = false;
    this.counter = new RepCounter();
    this.filters = {};
    this.view = null;                // smoothed body view
    this.issueFilter = new IssueFilter();
    this.raf = 0;
    this.lastT = 0;
    this.lastVideoTime = -1;
    this.last = null;                // last frame result (re-used when the camera has no new frame)
    this.demo = { holding: false, auto: false, lean: false, level: 0 };
    this._keys = this._keys.bind(this);
  }

  async start() {
    if (this.source === "camera") {
      const [landmarker] = await Promise.all([
        getLandmarker(),
        startCamera(this.video).then((s) => { this.stream = s; }),
      ]);
      this.landmarker = landmarker;
    } else {
      window.addEventListener("keydown", this._keys);
      window.addEventListener("keyup", this._keys);
    }
    this.lastT = performance.now();
    this.raf = requestAnimationFrame((t) => this._tick(t));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    stopCamera(this.stream);
    window.removeEventListener("keydown", this._keys);
    window.removeEventListener("keyup", this._keys);
  }

  setRange(min, max) { this.range = { min, max: Math.max(max, min + 8) }; }

  /** goal = the level (0..1) the patient is asked to reach; reps are judged against it. */
  setGoal(goal) { this.counter.setGoal(goal); }

  setPlaying(on) { this.playing = on; this.counter.reset(); this.issueFilter.reset(); }

  _keys(e) {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      this.demo.holding = e.type === "keydown";
    }
    if (e.code === "KeyL") this.demo.lean = e.type === "keydown";
  }

  _level(primary) {
    if (!this.range) return 0;
    return Math.max(0, Math.min(1, (primary - this.range.min) / (this.range.max - this.range.min)));
  }

  _smooth(raw, dt) {
    const out = {};
    for (const k of Object.keys(raw)) {
      if (!this.filters[k]) this.filters[k] = new OneEuro();
      out[k] = this.filters[k].filter(raw[k], Math.max(dt, 1 / 120));
    }
    return out;
  }

  _tick(t) {
    this.raf = requestAnimationFrame((tt) => this._tick(tt));
    let raw = null, vis = 1, landmarks = null, other = null, bodySeen = false;

    if (this.source === "camera") {
      // only work when the camera has delivered a NEW frame (otherwise the same picture is counted twice)
      if (!this.video.videoWidth || this.video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = this.video.currentTime;
      const dt = Math.min(0.2, (t - this.lastT) / 1000);
      this.lastT = t;
      const res = this.landmarker && detect(this.landmarker, this.video, t);
      if (res) {
        landmarks = res.landmarks;
        const P = toPoints(res.landmarks, this.video.videoWidth / this.video.videoHeight);
        vis = visibility(res.landmarks, this.side, this.cfg.joints);
        // the body itself is seen (shoulders + hips), even if the exercising arm/leg is hidden
        bodySeen = Math.max(res.landmarks[11].visibility, res.landmarks[12].visibility) > 0.5 &&
                   Math.max(res.landmarks[23].visibility, res.landmarks[24].visibility) > 0.5;
        raw = computeAngles(P, this.side);
        const v = bodyView(P, res.world);
        this.view = this.view
          ? { ratio: this.view.ratio + 0.2 * (v.ratio - this.view.ratio), nearScore: this.view.nearScore + 0.2 * (v.nearScore - this.view.nearScore) }
          : { ratio: v.ratio, nearScore: v.nearScore };
        this.view.near = this.view.nearScore >= 0 ? "left" : "right";
        if (this.cfg.joints === "arm") other = armAngles(P, OTHER[this.side]);
      } else {
        vis = 0;
      }
      this._draw(landmarks, vis);
      this._process(raw, vis, other, dt, t, false, bodySeen);
    } else {
      const dt = Math.min(0.1, (t - this.lastT) / 1000);
      this.lastT = t;
      const d = this.demo;
      const target = d.auto ? (Math.sin(t / 1000) > 0 ? 1.02 : 0) : d.holding ? 1.02 : 0;
      d.level += (target - d.level) * Math.min(1, dt * 2.6);
      const r = this.range || { min: 5, max: this.exercise.default_target };
      const goalDeg = r.min + Math.min(1.02, d.level) * this.counter.goal * (r.max - r.min);
      raw = anglesFromPrimary(this.cfg.primary, goalDeg, d.lean ? 22 : 0);
      this._process(raw, 1, null, dt, t, true);
    }
  }

  _process(raw, vis, other, dt, t, demo = false, bodySeen = false) {
    const angles = raw ? (demo ? raw : this._smooth(raw, dt)) : this.last?.angles || null;
    const visible = vis >= 0.5 && angles;
    const primary = angles ? primaryValue(this.cfg.primary, angles) : 0;
    const level = this._level(primary);

    // Standing the wrong way round / wrong side is checked first: it is usually the REASON
    // the exercising arm or leg is hidden, so "turn around" is more useful than "step back".
    const posture = demo || !(visible || bodySeen) ? [] : postureIssues({
      cameraView: this.exercise.camera_view, side: this.planSide, joints: this.cfg.joints,
      view: this.view, mine: angles ? { shoulder: angles.shoulder } : null, other,
    });
    let frameIssues;
    if (posture.length) frameIssues = posture;
    else if (!visible) frameIssues = ["not_visible"];
    else frameIssues = formIssues(this.exercise.id, angles, level);
    const issues = this.issueFilter.push(frameIssues);
    const blocked = issues.some((i) => POSTURE_ISSUES.includes(i));

    if (this.playing && !blocked && angles) {
      const { rep, reached } = this.counter.update(level, angles, frameIssues.filter((i) => !POSTURE_ISSUES.includes(i)), t);
      if (reached) this.onReach?.();
      if (rep) this.onRep?.({ ...rep, flags: repFlags(rep) });
    }
    this.last = { angles, primary, level, vis, issues, blocked, phase: this.counter.phase(), t, view: this.view };
    this.onFrame?.(this.last);
  }

  _draw(landmarks, vis) {
    const c = this.canvas;
    if (!c) return;
    const w = (c.width = this.video.videoWidth || 640);
    const h = (c.height = this.video.videoHeight || 480);
    const g = c.getContext("2d");
    g.clearRect(0, 0, w, h);
    if (!landmarks) return;
    const hl = highlighted(this.side, this.cfg.joints).map(([a, b]) => `${a}-${b}`);
    g.lineCap = "round";
    for (const [a, b] of SKELETON) {
      const p = landmarks[a], q = landmarks[b];
      const on = hl.includes(`${a}-${b}`) || hl.includes(`${b}-${a}`);
      g.strokeStyle = on ? "#F4A40C" : "rgba(255,255,255,0.75)";
      g.lineWidth = on ? 7 : 3;
      g.beginPath(); g.moveTo(p.x * w, p.y * h); g.lineTo(q.x * w, q.y * h); g.stroke();
    }
    if (vis < 0.5) {
      g.fillStyle = "rgba(212,36,110,0.25)";
      g.fillRect(0, 0, w, h);
    }
  }
}
