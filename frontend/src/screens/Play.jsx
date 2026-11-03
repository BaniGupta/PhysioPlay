import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useT } from "../i18n";
import { SessionEngine } from "../engine/sessionEngine";
import { createGame } from "../games/createGame";
import { sfx, unlockAudio, setMuted, isMuted } from "../games/sounds";
import { Stars } from "../components/Charts";
import { Logo } from "../components/TopBar";
import { Tile } from "../components/Pattern";
import { GAMES } from "../exercises";

const REST_SECONDS = 8;
const GAME_KEY = "physioplay.game.";

function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; }
function pct(a, p) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; }

function GameIcon({ game }) {
  const common = { width: 46, height: 46, viewBox: "0 0 46 46", "aria-hidden": true };
  if (game === "hand_pump") return (
    <svg {...common}><rect x="14" y="10" width="10" height="28" rx="3" fill="#2F5D50" /><path d="M19 12 L40 6" stroke="#2F5D50" strokeWidth="4" strokeLinecap="round" /><circle cx="38" cy="7" r="4" fill="#F4A40C" /><rect x="22" y="18" width="12" height="5" fill="#2F5D50" /><path d="M32 26 q2 6 0 10" stroke="#58A6E8" strokeWidth="3" fill="none" /></svg>
  );
  if (game === "balloon_pop") return (
    <svg {...common}><ellipse cx="27" cy="18" rx="11" ry="13" fill="#D4246E" /><path d="M27 31 q-3 6 0 12" stroke="#1F2350" strokeWidth="1.5" fill="none" /><path d="M6 22 L14 18 L6 14 Z" fill="#F4A40C" /><line x1="14" y1="18" x2="18" y2="18" stroke="#9AA3B5" strokeWidth="2" /></svg>
  );
  return (
    <svg {...common}><circle cx="34" cy="14" r="9" fill="none" stroke="#D4246E" strokeWidth="3" strokeDasharray="4 2" /><ellipse cx="16" cy="26" rx="11" ry="8" fill="#F4A40C" /><path d="M12 22 L20 14 L24 22 Z" fill="#D4246E" /><circle cx="22" cy="24" r="2" fill="#1F2350" /></svg>
  );
}

export default function Play() {
  const { courseId, exerciseId } = useParams();
  const nav = useNavigate();
  const { t, errText } = useT();

  const [stage, setStage] = useState("starting"); // starting|source|calibrate|countdown|playing|rest|pain|result
  const [session, setSession] = useState(null);
  const [source, setSource] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const [hud, setHud] = useState({ level: 0, issue: null, vis: 1, primary: 0, phase: "rest", blocked: false });
  const [calib, setCalib] = useState({ step: "frame", seconds: 0 });
  const [countdown, setCountdown] = useState(3);
  const [restLeft, setRestLeft] = useState(REST_SECONDS);
  const [reps, setReps] = useState([]);
  const [counted, setCounted] = useState(0);
  const [pending, setPending] = useState(false);   // goal reached, rep finishes when the patient comes back
  const [pain, setPain] = useState(null);
  const [result, setResult] = useState(null);
  const [muted, setMutedState] = useState(isMuted());
  const [demoAuto, setDemoAuto] = useState(false);
  const [goalDeg, setGoalDeg] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const gameDivRef = useRef(null);
  const engineRef = useRef(null);
  const gameRef = useRef(null);
  const bridgeRef = useRef({ controls: { level: 0, formOk: true, cue: "", cueWarn: false }, events: [], config: {}, t });
  const frameRef = useRef(null);
  const calibRef = useRef(null);
  const countedRef = useRef(0);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const onRepRef = useRef(null);
  const finishCalibRef = useRef(null);
  const cueRef = useRef(() => ({ text: "", warn: false }));
  bridgeRef.current.t = t;

  const plan = session?.plan;
  const exercise = session?.exercise;
  const totalReps = plan ? plan.reps * plan.sets : 0;

  // ---------- start a session on the backend ----------
  useEffect(() => {
    api.post("/sessions", { course_id: Number(courseId), exercise_id: exerciseId })
      .then((s) => {
        setSession(s);
        let saved = null;
        try { saved = localStorage.getItem(GAME_KEY + exerciseId); } catch { /* ignore */ }
        setGame(GAMES.includes(saved) ? saved : s.exercise.default_game);
        setStage("source");
      })
      .catch((e) => setError(errText(e)));
    return () => {
      engineRef.current?.stop();
      gameRef.current?.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, exerciseId]);

  // ---------- HUD refresh (10x per second is plenty for text) ----------
  useEffect(() => {
    const id = setInterval(() => {
      const f = frameRef.current;
      if (f) setHud({ level: f.level, issue: f.issues[0] || null, vis: f.vis, primary: f.primary, phase: f.phase, blocked: f.blocked });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ---------- each rep the browser counts -> backend scores it ----------
  const onRep = useCallback(async (rep) => {
    if (stageRef.current !== "playing" || !session) return;
    const n = (countedRef.current += 1);
    setCounted(n);
    setPending(false);
    const repsPerSet = session.plan.reps;
    const total = session.plan.reps * session.plan.sets;
    try {
      const res = await api.post(`/sessions/${session.session_id}/reps`, {
        rep_no: n,
        frames: rep.frames.map(({ issues, ...angles }) => angles),
        flags: rep.flags,
        duration: rep.duration,
      });
      setReps((r) => [...r, { ...res, flags: rep.flags }]);
      bridgeRef.current.events.push({ type: "rep", score: res.score, flags: rep.flags });
    } catch (e) {
      setError(errText(e));
    }
    if (n % repsPerSet === 0) {
      const last = n >= total;
      bridgeRef.current.events.push({ type: "set", set: n / repsPerSet, last });
      engineRef.current?.setPlaying(false);
      setTimeout(() => setStage(last ? "pain" : "rest"), 1800);
    }
  }, [session, errText]);

  // ---------- every frame: drive the game + calibration ----------
  const onFrame = useCallback((f) => {
    frameRef.current = f;
    const b = bridgeRef.current;
    b.controls.level = f.level;
    b.controls.formOk = f.issues.length === 0;
    const cue = cueRef.current(f);
    b.controls.cue = stageRef.current === "playing" ? cue.text : "";
    b.controls.cueWarn = cue.warn;

    const c = calibRef.current;
    if (!c || stageRef.current !== "calibrate") return;
    if (c.step === "frame") {
      c.ok = f.vis >= 0.6 && !f.blocked ? c.ok + 1 : 0;
      if (c.ok > 25) { c.step = "rest"; c.t0 = f.t; c.samples = []; sfx.tick(); }
    } else if (c.step === "rest" || c.step === "move") {
      if (f.vis >= 0.5 && !f.blocked) c.samples.push(f.primary);
      const dur = c.step === "rest" ? 2500 : 4000;
      const left = Math.ceil((dur - (f.t - c.t0)) / 1000);
      if (left !== c.left) { c.left = left; setCalib({ step: c.step, seconds: Math.max(0, left) }); }
      if (f.t - c.t0 >= dur) {
        if (c.step === "rest") {
          c.min = median(c.samples);
          c.step = "move"; c.t0 = f.t; c.samples = []; sfx.tick();
        } else {
          c.step = "done";
          finishCalibRef.current(c.min, pct(c.samples, 0.9));
        }
      }
      return;
    }
    setCalib((s) => (s.step === c.step ? s : { step: c.step, seconds: 0 }));
  }, []);

  // ---------- choose camera or demo ----------
  async function chooseSource(src) {
    unlockAudio();
    setError("");
    setSource(src);
    try { localStorage.setItem(GAME_KEY + exerciseId, game); } catch { /* ignore */ }
    const engine = new SessionEngine({
      exercise, side: session.side, source: src,
      video: videoRef.current, canvas: canvasRef.current, onFrame, onRep: (r) => onRepRef.current(r),
      onReach: () => {
        if (stageRef.current !== "playing") return;
        bridgeRef.current.events.push({ type: "reach" });
        setPending(true);
      },
    });
    engineRef.current = engine;
    try {
      await engine.start();
    } catch (e) {
      engine.stop();
      engineRef.current = null;
      setSource(null);
      setError(errText(e));
      return;
    }
    if (src === "demo") {
      const cal = session.calibration || { min_angle: 5, max_angle: plan.target_rom };
      applyRange(cal.min_angle, cal.max_angle);
      startCountdown();
    } else {
      setStage("calibrate");
      if (!session.calibration) beginCalibration();
    }
  }

  function beginCalibration() {
    calibRef.current = { step: "frame", ok: 0, samples: [] };
    setCalib({ step: "frame", seconds: 0 });
  }

  async function finishCalibration(min, max) {
    if (max - min < 8) {
      setError(t("calib.nomove"));
      beginCalibration();
      return;
    }
    setError("");
    try {
      await api.put(`/courses/${courseId}/calibration/${exerciseId}`, { min_angle: Math.max(0, min), max_angle: Math.min(180, max) });
    } catch (e) { setError(errText(e)); }
    applyRange(min, max);
    sfx.fanfare();
    startCountdown();
  }

  onRepRef.current = onRep;
  finishCalibRef.current = finishCalibration;
  cueRef.current = (f) => cueFor(t, f, session, exercise);

  // The game scale goes from the patient's rest angle up to their comfortable max (or the target,
  // whichever is higher, but never past the safe maximum). The GOAL is the target — unless the
  // patient's own calibrated range is smaller, then the goal is what they can comfortably reach.
  // Balloons, hoops and the "reached" line of the rep counter all follow this goal.
  function applyRange(min, max) {
    const scaleMax = Math.min(plan.max_rom, Math.max(max, plan.target_rom));
    const span = Math.max(8, scaleMax - min);
    const targetLevel = (plan.target_rom - min) / span;
    const comfortLevel = (max - min) / span;
    const goal = Math.max(0.3, Math.min(1, targetLevel, comfortLevel));
    engineRef.current.setRange(min, scaleMax);
    engineRef.current.setGoal(goal);
    bridgeRef.current.config = { repsPerSet: plan.reps, sets: plan.sets, targetLevel: goal };
    setGoalDeg(Math.round(min + goal * span));
  }

  async function startCountdown() {
    setStage("countdown");
    if (!gameRef.current) gameRef.current = await createGame(gameDivRef.current, game, bridgeRef.current);
    let n = 3;
    setCountdown(n);
    sfx.tick();
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setStage("playing");
        engineRef.current.setPlaying(true);
        sfx.pop();
      } else { setCountdown(n); sfx.tick(); }
    }, 1000);
  }

  // rest between sets
  useEffect(() => {
    if (stage !== "rest") return;
    let n = REST_SECONDS;
    setRestLeft(n);
    const id = setInterval(() => {
      n -= 1;
      setRestLeft(n);
      if (n <= 0) { clearInterval(id); setStage("playing"); engineRef.current?.setPlaying(true); sfx.pop(); }
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  function finishEarly() {
    engineRef.current?.setPlaying(false);
    if (countedRef.current === 0) { nav("/home"); return; }
    setStage("pain");
  }

  async function submitPain() {
    try {
      const res = await api.post(`/sessions/${session.session_id}/complete`, { pain, game });
      engineRef.current?.stop();
      setResult(res);
      setStage("result");
      if (res.level_up || res.new_badges.length) setTimeout(() => sfx.fanfare(), 500);
    } catch (e) { setError(errText(e)); }
  }

  function toggleMute() { setMuted(!muted); setMutedState(!muted); }
  function toggleAuto() {
    const e = engineRef.current;
    if (!e) return;
    e.demo.auto = !e.demo.auto;
    setDemoAuto(e.demo.auto);
  }
  const hold = (on) => { if (engineRef.current && source === "demo") engineRef.current.demo.holding = on; };

  // ---------- render ----------
  if (error && !session) {
    return (
      <div className="play-shell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
        <div className="overlay-card stack">
          <h2>{t("play.cantstart")}</h2><p>{error}</p>
          <Link className="btn" to="/home">{t("result.home")}</Link>
        </div>
      </div>
    );
  }

  // a rep is shown as done the moment the goal is reached (it is scored when the patient comes back)
  const shown = counted + (pending && stage === "playing" ? 1 : 0);
  const setNo = plan ? Math.min(plan.sets, Math.floor(counted / plan.reps) + (stage === "rest" ? 0 : 1)) : 1;
  const inSet = plan && shown > 0 ? ((shown - 1) % plan.reps) + 1 : 0;
  const lastScored = reps[reps.length - 1];
  const exName = exercise ? t(`ex.${exercise.id}.name`) : "";
  const calibSteps = [
    ["frame", t("calib.frame")],
    ["rest", exercise ? t(`ex.${exercise.id}.rest`) : ""],
    ["move", exercise ? t(`ex.${exercise.id}.move`) : ""],
  ];

  return (
    <div className="play-shell">
      <div className="play-top">
        <Link to="/home" className="row" style={{ textDecoration: "none", color: "#fff", gap: 8 }} aria-label={t("result.home")}>
          <Logo size={28} />
        </Link>
        <span className="title">{exName || t("play.preparing")}</span>
        {game && stage !== "source" && <span className="chip game-chip">{t(`game.${game}`)}</span>}
        <div style={{ marginLeft: "auto" }} className="row">
          <button className="btn btn-ghost btn-small" onClick={toggleMute}>{muted ? t("play.sound.off") : t("play.sound.on")}</button>
          {(stage === "playing" || stage === "rest") && (
            <button className="btn btn-small stop-btn" onClick={finishEarly}>{t("play.finish")}</button>
          )}
        </div>
      </div>

      <div className="play-stage">
        <div className="game-frame" style={{ aspectRatio: "960 / 600" }}
          onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}>
          <div ref={gameDivRef} className="game-host" />

          {stage === "starting" && <div className="overlay"><p>{t("play.preparing")}</p></div>}

          {stage === "source" && exercise && (
            <div className="overlay" style={{ overflowY: "auto", alignItems: "start" }}>
              <div className="overlay-card stack" style={{ "--gap": "14px", margin: "auto", textAlign: "left" }}>
                <h2>{exName}</h2>
                <p className="muted">{t(`ex.${exercise.id}.how`)}</p>
                <p className="faint">{t("play.camera.place", { view: t(`view.${exercise.camera_view}`) })}</p>

                <div className="field">
                  <span className="label-text">{t("play.choosegame")}</span>
                  <div className="game-picker" role="group">
                    {GAMES.map((g) => (
                      <button key={g} type="button" className="game-option" aria-pressed={game === g} onClick={() => setGame(g)}>
                        <GameIcon game={g} />
                        <strong>{t(`game.${g}`)}</strong>
                        <span className="faint">{t(`game.${g}.desc`)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <div className="error" role="alert">{error}</div>}
                <button className="btn btn-marigold btn-block" onClick={() => chooseSource("camera")}>{t("play.usecamera")}</button>
                <button className="btn btn-ghost btn-block" onClick={() => chooseSource("demo")}>{t("play.demo")}</button>
              </div>
            </div>
          )}

          {stage === "calibrate" && (
            <div className="overlay">
              <div className="overlay-card">
                <h2>{t("calib.title")}</h2>
                <p className="muted">{t("calib.sub")}</p>
                {!calibRef.current && session?.calibration ? (
                  <div className="stack" style={{ "--gap": "10px", marginTop: 18 }}>
                    <p>{t("calib.saved", { min: Math.round(session.calibration.min_angle), max: Math.round(session.calibration.max_angle) })}</p>
                    <button className="btn btn-marigold btn-block" onClick={() => {
                      applyRange(session.calibration.min_angle, session.calibration.max_angle); startCountdown();
                    }}>{t("calib.use")}</button>
                    <button className="btn btn-ghost btn-block" onClick={beginCalibration}>{t("calib.again")}</button>
                  </div>
                ) : (
                  <>
                    <div className="calib-steps">
                      {calibSteps.map(([key, text], i) => {
                        const order = ["frame", "rest", "move", "done"];
                        const state = order.indexOf(calib.step) > i ? "done" : calib.step === key ? "active" : "";
                        return (
                          <div key={key} className={`calib-step ${state}`}>
                            <div className="calib-num"><span>{state === "done" ? "✓" : i + 1}</span></div>
                            <span>{text}</span>
                          </div>
                        );
                      })}
                    </div>
                    {(calib.step === "rest" || calib.step === "move") && <div className="progress-ring">{calib.seconds}</div>}
                    {calib.step === "frame" && hud.vis < 0.6 && !hud.blocked && <p className="faint">{t("calib.waiting")}</p>}
                    {hud.blocked && <p className="calib-warn" role="alert">{cueFor(t, hud, session, exercise).text}</p>}
                    {error && <div className="error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
                  </>
                )}
              </div>
            </div>
          )}

          {stage === "countdown" && (
            <div className="overlay" style={{ background: "rgba(20,23,56,.45)" }}>
              <div className="countdown">{countdown}</div>
            </div>
          )}

          {stage === "rest" && (
            <div className="overlay" style={{ background: "rgba(20,23,56,.55)" }}>
              <div className="overlay-card">
                <h2>{t("rest.title")}</h2>
                <p className="muted">{t("rest.body")}</p>
                <div className="progress-ring">{restLeft}</div>
              </div>
            </div>
          )}

          {stage === "pain" && (
            <div className="overlay">
              <div className="overlay-card">
                <h2>{t("pain.title")}</h2>
                <p className="muted">{t("pain.sub")}</p>
                <div className="pain-scale" role="group">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button key={i} aria-pressed={pain === i} onClick={() => setPain(i)}>{i}</button>
                  ))}
                </div>
                <div className="spread faint" style={{ marginBottom: 16 }}><span>{t("pain.none")}</span><span>{t("pain.worst")}</span></div>
                {error && <div className="error" role="alert" style={{ marginBottom: 10 }}>{error}</div>}
                <button className="btn btn-marigold btn-block" disabled={pain === null} onClick={submitPain}>{t("pain.submit")}</button>
              </div>
            </div>
          )}

          {stage === "result" && result && (
            <Result result={result} plan={plan} reps={reps} scoredBy={lastScored?.scored_by} onAgain={() => window.location.reload()} />
          )}
        </div>

        <aside className="side-col">
          <div className="cam-box">
            <video ref={videoRef} playsInline muted style={{ display: source === "camera" ? "block" : "none" }} />
            <canvas ref={canvasRef} style={{ display: source === "camera" ? "block" : "none" }} />
            {source !== "camera" && (
              <div className="cam-empty">
                {source === "demo" ? (
                  <div className="stack" style={{ "--gap": "8px" }}>
                    <strong style={{ color: "#fff" }}>{t("demo.title")}</strong>
                    <span>{t("demo.space")}</span>
                    <span>{t("demo.lean")}</span>
                    <div><button className="btn btn-small btn-marigold" onClick={toggleAuto}>{demoAuto ? t("demo.stop") : t("demo.auto")}</button></div>
                  </div>
                ) : <span>{t("cam.preview")}</span>}
              </div>
            )}
          </div>

          <div className="hud-card">
            <div className="spread">
              <span className="label">{t("hud.set", { n: setNo, total: plan?.sets ?? "–" })}</span>
              <span className="label">{t("hud.reps", { n: shown, total: totalReps })}</span>
            </div>
            <div className="value num">{inSet}<span style={{ fontSize: "1.1rem", color: "#aeb2d8" }}> / {plan?.reps ?? "–"}</span></div>
            <div className="rep-pips" aria-hidden="true">
              {reps.slice(-(plan?.reps || 10)).map((r, i) => (
                <span key={i} className={`rep-pip ${r.score >= 85 ? "good" : r.score >= 65 ? "ok" : "low"}`} />
              ))}
            </div>
          </div>

          <div className="hud-card">
            <div className="spread"><span className="label">{t("hud.range")}</span><span className="num" style={{ fontWeight: 700 }}>{Math.round(hud.primary)}°</span></div>
            <div className="level-meter" style={{ marginTop: 8 }}><div style={{ width: `${Math.round(hud.level * 100)}%` }} /></div>
            {plan && <p className="label" style={{ marginTop: 6 }}>
              {goalDeg != null && goalDeg < Math.round(plan.target_rom) - 1
                ? t("hud.goal", { n: goalDeg, target: Math.round(plan.target_rom) })
                : t("hud.target", { n: Math.round(plan.target_rom) })}
            </p>}
          </div>

          {(stage === "playing" || stage === "calibrate") && (
            <div className={`cue ${hud.issue ? "warn" : ""}`} role="status" aria-live="polite">
              {hud.issue && <span className="cue-label">{t(hud.blocked ? "hud.fixfirst" : "hud.mistake")}</span>}
              {stage === "calibrate" && !hud.issue ? t("calib.ok") : cueFor(t, hud, session, exercise).text}
            </div>
          )}
          {lastScored && stage === "playing" && (
            <div className="hud-card">
              <span className="label">{t("hud.lastrep")}</span>
              <div className="spread">
                <span className="value num">{Math.round(lastScored.score)}</span>
                <span className="label" style={{ textAlign: "right" }}>
                  {t("hud.form", { n: Math.round(lastScored.form_score) })}<br />{t("hud.rangescore", { n: Math.round(lastScored.range_score) })}
                </span>
              </div>
              <p className="rep-mistakes">
                {lastScored.flags?.length
                  ? <>{t("hud.mistakes")} {lastScored.flags.map((f) => t(`mistake.${f}`)).join(", ")}</>
                  : t("hud.nomistakes")}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Result({ result, plan, reps, scoredBy, onAgain }) {
  const { t } = useT();
  const gain = result.previous_best != null ? Math.round(result.best_rom - result.previous_best) : null;
  // which mistakes happened most often this session -> one clear tip each
  const counts = {};
  reps.forEach((r) => (r.flags || []).forEach((f) => { counts[f] = (counts[f] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="overlay result-overlay">
      <div className="overlay-card stack result-hero" style={{ "--gap": "12px", margin: "auto" }}>
        <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true" style={{ margin: "0 auto" }}>
          <g className="pop-cell"><Tile cx={35} cy={35} r={32} /></g>
        </svg>
        <h2>{t(`result.${Math.max(1, result.stars)}`)}</h2>
        <Stars count={result.stars} size={46} animate />
        <div className="score num">{Math.round(result.avg_score)}</div>
        <p className="faint">{t("result.avg", { n: result.reps })}</p>

        <div className="result-stats">
          <div><div className="v num">{Math.round(result.best_rom)}°</div><div className="l">{t("result.best")}</div></div>
          <div><div className="v num">+{result.xp}</div><div className="l">{t("result.xp")}</div></div>
          <div><div className="v num">{result.streak}</div><div className="l">{t("result.streak")}</div></div>
        </div>

        {gain != null && gain > 0 && <p className="chip chip-sarson" style={{ margin: "0 auto" }}>{t("result.gain", { n: gain })}</p>}
        {result.level_up && <p className="chip chip-marigold" style={{ margin: "0 auto" }}>{t("result.level", { n: result.level })}</p>}
        {result.new_badges.map((b) => <p key={b} className="chip chip-rani" style={{ margin: "0 auto" }}>{t("result.badge", { name: t(`badge.${b}`) })}</p>)}
        {result.target_change && (
          <p className="muted">
            {result.target_change.reason === "raised"
              ? t("result.raised", { n: Math.round(result.target_change.new_target) })
              : t("result.lowered", { n: Math.round(result.target_change.new_target) })}
          </p>
        )}
        <div className="result-mistakes">
          {top.length ? (
            <>
              <strong>{t("result.mistakes")}</strong>
              <ul>{top.map(([f, n]) => <li key={f}><b>{t(`mistake.${f}`)}</b> ({t("result.times", { n })}) — {t(`tip.${f}`)}</li>)}</ul>
            </>
          ) : <strong>{t("result.nomistakes")}</strong>}
        </div>
        <p className="faint">
          {scoredBy && scoredBy !== "rules" ? t("result.byml", { name: scoredBy }) : t("result.byrules")}{" "}
          {t("hud.target", { n: Math.round(plan.target_rom) })}
        </p>

        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-marigold" to="/home">{t("result.home")}</Link>
          <button className="btn btn-ghost" onClick={onAgain}>{t("result.again")}</button>
        </div>
      </div>
    </div>
  );
}

/** What to tell the patient right now: the problem to fix first, the named mistake, or the next step. */
function cueFor(t, f, session, exercise) {
  const side = session?.side && session.side !== "none" ? t(`side.${session.side}`) : "";
  const issue = f?.issues ? f.issues[0] : f?.issue;
  if (issue) return { text: t(`cue.${issue}`, { side }), warn: true };
  if (!exercise) return { text: "", warn: false };
  const phase = f?.phase || "rest";
  if (phase === "up") return { text: t(`guide.up.${exercise.id}`), warn: false };
  if (phase === "back") return { text: t("guide.back"), warn: false };
  return { text: t("guide.start"), warn: false };
}
