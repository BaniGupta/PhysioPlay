// Start a new recovery plan: one account can have many plans (arm now, knee later...).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useT } from "../i18n";
import TopBar from "../components/TopBar";
import { AreaArt, ExerciseArt } from "../components/ExerciseArt";
import { AREAS, EXERCISE_IDS, EXERCISES, exercisesFor } from "../exercises";

const MAX_TEXT = 1000;

export default function PlanSetup() {
  const { t, errText } = useT();
  const nav = useNavigate();
  const [hasCourses, setHasCourses] = useState(false);
  const [area, setArea] = useState(null);
  const [side, setSide] = useState("right");
  const [description, setDescription] = useState("");
  const [pain, setPain] = useState(3);
  const [picked, setPicked] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/courses").then((cs) => setHasCourses(cs.length > 0)).catch(() => {});
  }, []);

  function chooseArea(a) {
    setArea(a);
    setPicked(exercisesFor(a));
    setSide(a === "back" ? "none" : side === "none" ? "right" : side);
    setShowAll(false);
  }

  const list = useMemo(() => {
    if (!area) return [];
    const own = exercisesFor(area);
    return showAll ? [...own, ...EXERCISE_IDS.filter((id) => !own.includes(id))] : own;
  }, [area, showAll]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function submit(e) {
    e.preventDefault();
    if (!area) { setError(t("setup.err.area")); return; }
    if (description.trim().length < 2) { setError(t("setup.err.describe")); return; }
    if (!picked.length) { setError(t("setup.err.exercise")); return; }
    setBusy(true); setError("");
    try {
      const course = await api.post("/courses", {
        body_area: area, side, description: description.trim(), baseline_pain: pain,
        exercise_ids: picked,
      });
      try { localStorage.setItem("physioplay.course", String(course.id)); } catch { /* ignore */ }
      nav("/home");
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  return (
    <>
      <TopBar />
      <main className="page page-narrow">
        <form className="stack" style={{ "--gap": "30px" }} onSubmit={submit}>
          <div className="stack" style={{ "--gap": "8px" }}>
            {hasCourses && <Link to="/home" className="faint">{t("common.cancel")}</Link>}
            <h1>{t("setup.title")}</h1>
            <p className="muted">{t("setup.sub")}</p>
          </div>

          <fieldset className="field">
            <legend className="label-text">{t("setup.area")}</legend>
            <div className="area-grid">
              {AREAS.map((a) => (
                <button type="button" key={a} className="choice area-choice" aria-pressed={area === a} onClick={() => chooseArea(a)}>
                  <AreaArt area={a} size={56} />
                  <span><strong>{t(`area.${a}`)}</strong><span className="faint">{t(`area.${a}.hint`)}</span></span>
                </button>
              ))}
            </div>
          </fieldset>

          {area && area !== "back" && (
            <fieldset className="field">
              <legend className="label-text">{t("setup.side")}</legend>
              <div className="choice-grid">
                {["left", "right"].map((s) => (
                  <button type="button" key={s} className="choice" aria-pressed={side === s} onClick={() => setSide(s)}>
                    <strong>{t(`side.${s}`)}</strong>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="field">
            <label htmlFor="desc">{t("setup.describe")}</label>
            <span className="hint">{t("setup.describe.hint")}</span>
            <textarea id="desc" className="input" rows={6} maxLength={MAX_TEXT} value={description}
              placeholder={t("setup.describe.placeholder")} onChange={(e) => setDescription(e.target.value)} />
            <span className="hint" style={{ textAlign: "right" }}>{t("setup.chars", { n: description.length })}</span>
          </div>

          <fieldset className="field">
            <legend className="label-text">{t("setup.pain")}</legend>
            <div className="pain-scale" role="group">
              {Array.from({ length: 11 }, (_, i) => (
                <button type="button" key={i} aria-pressed={pain === i} onClick={() => setPain(i)}>{i}</button>
              ))}
            </div>
            <span className="hint">{t("setup.pain.hint")}</span>
          </fieldset>

          {area && (
            <fieldset className="field">
              <legend className="label-text">{t("setup.exercises")}</legend>
              <span className="hint">{t("setup.exercises.hint")}</span>
              <div className="stack" style={{ "--gap": "10px", marginTop: 6 }}>
                {list.map((id) => (
                  <button type="button" key={id} className="choice exercise-choice" aria-pressed={picked.includes(id)} onClick={() => toggle(id)}>
                    <ExerciseArt id={id} size={60} />
                    <span>
                      <strong>{t(`ex.${id}.name`)}</strong>
                      <span className="faint">{t(`area.${EXERCISES[id].area}`)}</span>
                    </span>
                    <span className="check" aria-hidden="true">{picked.includes(id) ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="link-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? t("setup.showless") : t("setup.showall")}
              </button>
            </fieldset>
          )}


          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-marigold btn-block" disabled={busy}>{busy ? t("setup.saving") : t("setup.submit")}</button>
        </form>
      </main>
    </>
  );
}
