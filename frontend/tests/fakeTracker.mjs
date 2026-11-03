// Stands in for pose/poseTracker.js in tests: returns whatever frame the test set last.
let next = null;
export function setNext(p) { next = p; }
export async function getLandmarker() { return {}; }
export async function startCamera() { return null; }
export function stopCamera() {}
export function detect() { return next ? { landmarks: next.L, world: next.Wd } : null; }
