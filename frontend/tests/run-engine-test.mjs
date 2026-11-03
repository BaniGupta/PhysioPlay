// Run: node tests/run-engine-test.mjs
// Bundles tests/engine.test.mjs with a fake camera (tests/fakeTracker.mjs) and runs it in Node.
import { build } from "esbuild";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(here, "engine.test.mjs")], bundle: true, platform: "node", format: "esm",
  outfile: path.join(here, ".engine.bundle.mjs"), logLevel: "warning",
  banner: { js: "globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};" },
  plugins: [{ name: "fake-camera", setup(b) { b.onResolve({ filter: /poseTracker$/ }, () => ({ path: path.join(here, "fakeTracker.mjs") })); } }],
});
execFileSync("node", [path.join(here, ".engine.bundle.mjs")], { stdio: "inherit" });
