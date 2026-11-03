const rad = (d) => (d * Math.PI) / 180;
// Build 33 image landmarks (0-1) + world landmarks. view: "front" | "side-left" | "side-right"
export function makePose({ view = "front", leftArm = 0, rightArm = 0, leftElbow = 180, rightElbow = 180, upperFwd = 0, lean = 0, noise = 0 }) {
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
  if (noise) for (const q of L) { q.x += (Math.random() - 0.5) * 2 * noise; q.y += (Math.random() - 0.5) * 2 * noise; }
  return { L, Wd };
}
