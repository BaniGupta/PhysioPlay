// Browser-side info about each exercise. Names and instructions live in i18n/*.js
// (keys "ex.<id>.name", "ex.<id>.how", ...). Targets and limits come from the backend.
//
// primary = which movement drives the game (must match backend/app/ml/scorer.py):
//   elbow_flexion  180 - elbow angle      (0 = straight arm)
//   shoulder       shoulder angle         (0 = arm by your side)
//   knee_flexion   180 - knee angle       (0 = standing straight)
//   knee_extension knee angle - 90        (0 = knee bent at 90°, sitting)
//   side_bend      sideways trunk lean
// joints = which body points must be clearly visible.

export const AREAS = ["shoulder", "arm", "leg", "back"];

export const EXERCISES = {
  elbow_flexion: { area: "arm", primary: "elbow_flexion", joints: "arm" },
  shoulder_abduction: { area: "shoulder", primary: "shoulder", joints: "arm" },
  shoulder_flexion: { area: "shoulder", primary: "shoulder", joints: "arm" },
  squat: { area: "leg", primary: "knee_flexion", joints: "leg" },
  sit_to_stand: { area: "leg", primary: "knee_extension", joints: "leg" },
  knee_extension: { area: "leg", primary: "knee_extension", joints: "leg" },
  side_bend: { area: "back", primary: "side_bend", joints: "trunk" },
};

export const EXERCISE_IDS = Object.keys(EXERCISES);
export const exercisesFor = (area) => EXERCISE_IDS.filter((id) => EXERCISES[id].area === area);

// Every game works with every exercise: games only read "how far you moved" (0..1) and "rep finished".
export const GAMES = ["bird_flight", "hand_pump", "balloon_pop"];

export function courseLabel(t, c) {
  return c.side && c.side !== "none" ? `${t(`area.${c.body_area}`)} · ${t(`side.${c.side}`)}` : t(`area.${c.body_area}`);
}
