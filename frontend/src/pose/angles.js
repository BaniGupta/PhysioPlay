// MediaPipe points -> joint angles (degrees) + "is the person standing the right way?" checks.
//
//   elbow      = shoulder - elbow - wrist   (180 = straight arm)
//   shoulder   = hip - shoulder - elbow     (0 = arm down by your side)
//   trunk      = spine vs vertical          (0 = standing straight)
//   trunk_side = spine vs vertical (same line; in a front view this is the sideways lean)
//   knee       = hip - knee - ankle         (180 = straight leg)
//   hip        = shoulder - hip - knee      (180 = standing straight)
//
// WHY 2D: every exercise is filmed so that the movement happens across the picture
// (side view for bending/raising forward, front view for raising sideways). In that plane
// the picture angle IS the joint angle, and it is far steadier than MediaPipe's guessed depth.
// The depth guess (world landmarks) is only used to tell which side of the body faces the camera.
//
// MediaPipe names sides from the PERSON's point of view (LEFT_ELBOW = your left elbow).

export const MP = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
};
export const OTHER = { left: "right", right: "left" };

const deg = (r) => (r * 180) / Math.PI;

/** Angle at b (degrees) between b->a and b->c, in the picture plane. */
export function angle2(a, b, c) {
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
  const cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) + 1e-9);
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/** Image landmarks (0-1) -> points in the same units on both axes. */
export function toPoints(landmarks, aspect = 4 / 3) {
  return landmarks.map((p) => ({ x: p.x * aspect, y: p.y, v: p.visibility ?? 1 }));
}

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export function armAngles(P, side) {
  const j = MP[side];
  return { elbow: angle2(P[j.shoulder], P[j.elbow], P[j.wrist]), shoulder: angle2(P[j.hip], P[j.shoulder], P[j.elbow]) };
}

export function computeAngles(P, side) {
  const j = MP[side];
  const sh = mid(P[11], P[12]), hp = mid(P[23], P[24]);
  const lean = deg(Math.atan2(Math.abs(sh.x - hp.x), Math.abs(hp.y - sh.y) + 1e-9));
  return {
    ...armAngles(P, side),
    trunk: lean,
    trunk_side: lean,
    knee: angle2(P[j.hip], P[j.knee], P[j.ankle]),
    hip: angle2(P[j.shoulder], P[j.hip], P[j.knee]),
  };
}

/**
 * How the person stands towards the camera.
 *   ratio    shoulder width / torso height in the picture: about 0.6-0.9 facing the camera,
 *            about 0-0.35 standing sideways.
 *   near     which side of the body is closer to the camera ("left" | "right"), from the
 *            depth guess and from which arm MediaPipe sees more clearly.
 */
export function bodyView(P, world) {
  const torso = dist(mid(P[11], P[12]), mid(P[23], P[24])) + 1e-9;
  const ratio = dist(P[11], P[12]) / torso;
  const visL = (P[11].v + P[13].v + P[15].v + P[23].v) / 4;
  const visR = (P[12].v + P[14].v + P[16].v + P[24].v) / 4;
  // world z: smaller = closer to the camera
  const dz = world ? (world[12].z + world[24].z) / 2 - (world[11].z + world[23].z) / 2 : 0;
  const leftCloser = dz * 4 + (visL - visR);
  return { ratio, near: leftCloser >= 0 ? "left" : "right", nearScore: leftCloser };
}

const NEEDED = {
  arm: (j) => [j.shoulder, j.elbow, j.wrist, j.hip],
  leg: (j) => [j.shoulder, j.hip, j.knee, j.ankle],
  trunk: () => [11, 12, 23, 24],
};

/** How well the points this exercise needs are seen (0-1), plus "is it inside the picture". */
export function visibility(landmarks, side, joints) {
  const ids = NEEDED[joints](MP[side]);
  let v = Math.min(...ids.map((i) => landmarks[i]?.visibility ?? 0));
  const out = ids.some((i) => { const p = landmarks[i]; return !p || p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99; });
  if (out) v = Math.min(v, 0.3);
  return v;
}

/** The one number that drives the game, in degrees moved (must match backend scorer.primary_series). */
export function primaryValue(primary, a) {
  switch (primary) {
    case "elbow_flexion": return Math.max(0, 180 - a.elbow);
    case "shoulder": return a.shoulder;
    case "knee_flexion": return Math.max(0, 180 - a.knee);
    case "knee_extension": return Math.max(0, a.knee - 90);
    case "side_bend": return a.trunk_side;
    default: return 0;
  }
}

/** Demo mode: believable angles for a given amount of movement. lean = fake bad form. */
export function anglesFromPrimary(primary, v, lean = 0) {
  const base = { elbow: 172, shoulder: 12, trunk: 3, trunk_side: 3, knee: 176, hip: 176 };
  switch (primary) {
    case "elbow_flexion": return { ...base, elbow: 180 - v, trunk: 3 + lean, trunk_side: 3 + lean };
    case "shoulder": return { ...base, shoulder: v, trunk: 3 + lean, trunk_side: 3 + lean };
    case "knee_flexion": return { ...base, knee: 180 - v, hip: 180 - v * 1.1, trunk: v * 0.35 + lean * 1.6, trunk_side: v * 0.35 + lean * 1.6 };
    case "knee_extension": return { ...base, knee: 90 + v, hip: 95, trunk: 5 + lean, trunk_side: 5 + lean };
    case "side_bend": return { ...base, trunk_side: v, trunk: v + lean };
    default: return base;
  }
}

export const SKELETON = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

/** Which bones to highlight for this exercise. */
export function highlighted(side, joints) {
  const j = MP[side];
  if (joints === "arm") return [[j.shoulder, j.elbow], [j.elbow, j.wrist]];
  if (joints === "leg") return [[j.hip, j.knee], [j.knee, j.ankle]];
  return [[11, 23], [12, 24], [11, 12], [23, 24]];
}
