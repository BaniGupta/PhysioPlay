import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useT } from "../i18n";
import TopBar from "../components/TopBar";
import { RomChart } from "../components/Charts";
import { PracticeCalendar } from "../components/Pattern";
import { ExerciseArt } from "../components/ExerciseArt";
import { courseLabel } from "../exercises";

export default function Progress() {
  const { t, errText } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback((cid) => {
    let id = cid;
    if (!id) { try { id = Number(localStorage.getItem("physioplay.course")) || null; } catch { id = null; } }
    api.get(`/progress${id ? `?course_id=${id}` : ""}`).then(setData).catch((e) => setError(errText(e)));
  }, [errText]);
  useEffect(() => { load(null); }, [load]);

  if (error) return <><TopBar /><main className="page"><div className="error">{error}</div></main></>;
  if (!data) return <><TopBar /><main className="page"><p className="muted">{t("common.loading")}</p></main></>;

  return (
    <>
      <TopBar />
      <main className="page stack" style={{ "--gap": "26px" }}>
        <div className="stack" style={{ "--gap": "6px" }}>
          <h1>{t("progress.title")}</h1>
          <p className="muted">{t("progress.sub")}</p>
        </div>

        {data.courses.length > 1 && (
          <nav className="course-tabs">
            {data.courses.map((c) => (
              <button key={c.id} className="course-tab" aria-pressed={data.course?.id === c.id} onClick={() => load(c.id)}>
                {courseLabel(t, c)}
                {c.status === "completed" && <span className="chip" style={{ marginLeft: 8 }}>{t("home.finished")}</span>}
              </button>
            ))}
          </nav>
        )}

        {data.exercises.map((ex) => {
          const n = ex.series.length;
          const gain = n > 1 ? Math.round(ex.series[n - 1].best_rom - ex.first_rom) : null;
          return (
            <section key={ex.exercise_id} className="panel stack" style={{ "--gap": "16px" }}>
              <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                <ExerciseArt id={ex.exercise_id} size={64} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 style={{ fontSize: "var(--step-1)" }}>{t(`ex.${ex.exercise_id}.name`)}</h2>
                  <p className="muted">
                    {n === 0 ? t("progress.none")
                      : gain > 0 ? t("progress.up", { n: gain, best: Math.round(ex.best_rom) })
                      : t("progress.count", { n, best: Math.round(ex.best_rom) })}
                  </p>
                </div>
                {gain > 0 && <span className="chip chip-sarson" style={{ fontSize: "1rem", padding: "6px 14px" }}>+{gain}°</span>}
              </div>
              <RomChart series={ex.series} target={ex.target_rom} />
            </section>
          );
        })}

        <section className="panel stack" style={{ "--gap": "12px", maxWidth: 560 }}>
          <h2 style={{ fontSize: "var(--step-1)" }}>{t("cal.weeks8")}</h2>
          <PracticeCalendar days={data.calendar} />
          <p className="faint">{t("cal.legend", { n: data.gamification.longest_streak })}</p>
        </section>
      </main>
    </>
  );
}
