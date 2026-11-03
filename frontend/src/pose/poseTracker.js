// Camera + MediaPipe Pose Landmarker. Runs fully in the browser: video never leaves the device.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

let landmarkerPromise = null;

async function makeLandmarker(delegate) {
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.6,
  });
}

/** Loads the pose model once (GPU if possible, otherwise CPU). */
export function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = makeLandmarker("GPU").catch(() => makeLandmarker("CPU"));
    landmarkerPromise = landmarkerPromise.catch(() => {
      landmarkerPromise = null;
      throw camError("pose_failed", "The pose model didn't load.");
    });
  }
  return landmarkerPromise;
}

// Errors carry a code so the screen can show them in the user's language (i18n "err.<code>").
function camError(code, message) { const e = new Error(message); e.code = code; return e; }

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw camError("cam_unsupported", "This browser can't open the camera.");
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
  } catch (e) {
    if (e.name === "NotAllowedError") throw camError("cam_blocked", "Camera permission was blocked.");
    if (e.name === "NotFoundError") throw camError("cam_notfound", "No camera found.");
    throw camError("cam_failed", `The camera didn't start (${e.name}).`);
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Returns { landmarks (image coords 0-1), world (metres, hip-centred) } or null when nobody is seen. */
export function detect(landmarker, video, timestampMs) {
  if (!video.videoWidth) return null;
  const res = landmarker.detectForVideo(video, timestampMs);
  if (!res.landmarks?.length) return null;
  return { landmarks: res.landmarks[0], world: res.worldLandmarks[0] };
}
