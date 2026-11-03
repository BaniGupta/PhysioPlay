// Simple figure illustrations for each exercise. Pink = the moving part, marigold arc = the movement.
const BG = { arm: "#FFF1D3", shoulder: "#FDE4EE", leg: "#E0F1E6", back: "#E6E8F7" };
const AREA_OF = {
  elbow_flexion: "arm", shoulder_abduction: "shoulder", shoulder_flexion: "shoulder",
  squat: "leg", sit_to_stand: "leg", knee_extension: "leg", side_bend: "back",
};
const AREA_PICTURE = { arm: "elbow_flexion", shoulder: "shoulder_abduction", leg: "squat", back: "side_bend" };

const INK = "#1F2350", RANI = "#D4246E", GOLD = "#F4A40C";
const s = { stroke: INK, strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
const ghost = { ...s, strokeOpacity: 0.2, strokeDasharray: "4 6" };
const arc = { stroke: GOLD, strokeWidth: 4, fill: "none", strokeLinecap: "round" };
const chair = { stroke: "#9AA0C0", strokeWidth: 4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

const FIGURES = {
  elbow_flexion: (<>
    <circle cx="46" cy="22" r="9" fill={INK} />
    <path d="M46 32 L46 66 M46 66 L38 92 M46 66 L54 92" {...s} />
    <path d="M46 38 L50 58" {...s} />
    <path d="M50 58 L66 40" {...s} stroke={RANI} />
    <path d="M50 58 L68 62" {...ghost} />
    <path d="M60 60 A12 12 0 0 0 62 46" {...arc} />
  </>),
  shoulder_abduction: (<>
    <circle cx="48" cy="22" r="9" fill={INK} />
    <path d="M48 32 L48 66 M48 66 L40 92 M48 66 L56 92" {...s} />
    <path d="M48 38 L36 62" {...s} />
    <path d="M48 38 L78 22" {...s} stroke={RANI} />
    <path d="M48 38 L60 62" {...ghost} />
    <path d="M58 58 A20 20 0 0 0 66 34" {...arc} />
  </>),
  shoulder_flexion: (<>
    <circle cx="42" cy="22" r="9" fill={INK} />
    <path d="M42 32 L42 66 M42 66 L36 92 M42 66 L50 92" {...s} />
    <path d="M42 38 L66 16" {...s} stroke={RANI} />
    <path d="M42 38 L44 64" {...ghost} />
    <path d="M50 60 A22 22 0 0 0 62 30" {...arc} />
  </>),
  squat: (<>
    <circle cx="40" cy="24" r="9" fill={INK} />
    <path d="M42 34 L50 58" {...s} />
    <path d="M44 40 L66 46" {...s} />
    <path d="M50 58 L68 66 L56 88" {...s} stroke={RANI} />
    <path d="M50 58 L52 88" {...ghost} />
    <path d="M60 80 A14 14 0 0 1 64 66" {...arc} />
  </>),
  sit_to_stand: (<>
    <path d="M18 60 L40 60 M18 60 L18 90 M40 60 L40 90 M18 60 L18 36" {...chair} />
    <circle cx="58" cy="22" r="9" fill={INK} />
    <path d="M56 32 L46 56" {...s} />
    <path d="M52 40 L70 50" {...s} />
    <path d="M46 56 L60 68 L58 90" {...s} stroke={RANI} />
    <path d="M72 66 L72 40 M66 46 L72 40 L78 46" {...arc} />
  </>),
  knee_extension: (<>
    <path d="M18 62 L48 62 M18 62 L18 90 M48 62 L48 90 M18 62 L18 30" {...chair} />
    <circle cx="32" cy="18" r="9" fill={INK} />
    <path d="M32 28 L32 58" {...s} />
    <path d="M32 36 L44 50" {...s} />
    <path d="M32 58 L56 58" {...s} />
    <path d="M56 58 L82 50" {...s} stroke={RANI} />
    <path d="M56 58 L58 86" {...ghost} />
    <path d="M70 80 A20 20 0 0 0 76 56" {...arc} />
  </>),
  side_bend: (<>
    <circle cx="34" cy="22" r="9" fill={INK} />
    <path d="M38 32 L48 62" {...s} stroke={RANI} />
    <path d="M48 62 L40 92 M48 62 L58 92" {...s} />
    <path d="M40 38 L28 64" {...s} />
    <path d="M42 36 L60 22" {...s} />
    <path d="M48 32 L48 62" {...ghost} />
    <path d="M60 40 A20 20 0 0 0 46 30" {...arc} />
  </>),
};

export function ExerciseArt({ id, size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true"
      style={{ background: BG[AREA_OF[id]] || "#eef0fb", borderRadius: 14, flexShrink: 0 }}>
      {FIGURES[id]}
    </svg>
  );
}

export function AreaArt({ area, size = 72 }) {
  return <ExerciseArt id={AREA_PICTURE[area]} size={size} />;
}
