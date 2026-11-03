// Copies MediaPipe's WASM files into public/ so the app does not depend on a CDN for them.
import { cpSync, existsSync, mkdirSync } from "node:fs";
const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dest = "public/mediapipe/wasm";
if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log("[copy-wasm] MediaPipe WASM copied to", dest);
}
