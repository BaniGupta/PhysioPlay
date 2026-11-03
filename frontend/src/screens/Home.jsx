import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useT } from "../i18n";
import TopBar from "../components/TopBar";
import { PracticeCalendar, Tile } from "../components/Pattern";
import { Stars, ThreadMeter } from "../components/Charts";
import { ExerciseArt } from "../components/ExerciseArt";
import { EXERCISE_IDS, courseLabel } from "../exercises";

const COURSE_KEY = "physioplay.course";
const savedCourse = () => { try { return Number(localStorage.getItem(COURSE_KEY)) || null; } catch { return null; } };
const saveCourse = (id) => { try { localStorage.setItem(COURSE_KEY, String(id)); } catch { /* ignore */ } };

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "home.morning" : h < 17 ? "home.afternoon" : "home.evening";
}

export default function Home() {
  const { t, fmtDate, errText } = useT();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);

  const load = useCallback((courseId) => {
    api.get(`/home${courseId ? `?course_id=${courseId}` : ""}`)
      .then((d) => {
        if (d.courses.length === 0) { nav("/plans/new", { replace: true }); return; }
        if (d.course) saveCourse(d.course.id);
        setData(d);
      })
      .catch((e) => setError(errText(e)));
  }, [nav, errText]);

  useEffect(() => { load(savedCourse()); }, [load]);

  async function finishCourse() {
    try {
      await api.post(`/courses/${data.course.id}/complete`);
      setConfirmFinish(false);
      try { localStorage.removeItem(COURSE_KEY); } catch { /* ignore */ }
      load(null);
    } catch (e) { setError(errText(e)); }
  }

  async function addExercise(id) {
    try { await api.post(`/courses/${data.course.id}/plans`, { exercise_id: id }); load(data.course.id); }
    catch (e) { setError(errText(e)); }
  }

  if (error && !data) return <><TopBar /><main className="page"><div className="error">{error}</div></main></>;
  if (!data) return <><TopBar /><main className="page"><p className="muted">{t("common.loading")}</p></main></>;

  const { gamification: g, plans, calendar, badges, course, courses } = data;
  const active = courses.filter((c) => c.status === "active");
  const first = data.name.split(" ")[0];
  const left = plans.filter((p) => !p.done_today);
  const minutes = left.reduce((m, p) => m + Math.ceil((p.reps * p.sets * 4) / 60) + 1, 0);
  const practised = calendar.filter((d) => d.sessions).length;
  const isActive = course?.status === "active";
  const notInPlan = EXERCISE_IDS.filter((id) => !plans.some((p) => p.exercise_id === id));

  return (
    <>
      <TopBar />
      <main className="page stack" style={{ "--gap": "26px" }}>
        <section className="stack" style={{ "--gap": "6px" }}>
          <p className="muted">{t(greetingKey())}</p>
          <h1>{t("home.hello", { name: first })}</h1>
          {course && isActive && (
            <p className="muted" style={{ fontSize: "var(--step-1)" }}>
              {plans.length === 0 ? t("home.noexercises") : left.length === 0 ? t("home.done") : t("home.left", { n: left.length, m: minutes })}
            </p>
          )}
        </section>

        <nav className="course-tabs" aria-label={t("home.newplan")}>
          {active.map((c) => (
            <button key={c.id} className="course-tab" aria-pressed={course?.id === c.id} onClick={() => load(c.id)}>
              {courseLabel(t, c)}
            </button>
          ))}
          <Link to="/plans/new" className="course-tab add">+ {t("home.newplan")}</Link>
        </nav>

        {!course || !isActive ? (
          <section className="empty stack" style={{ "--gap": "12px" }}>
            <h2 style={{ fontSize: "var(--step-1)" }}>{t("home.nocourse.title")}</h2>
            <p>{t("home.nocourse.body")}</p>
            <div><Link className="btn btn-marigold" to="/plans/new">{t("home.newplan")}</Link></div>
          </section>
        ) : (
          <div className="home-grid">
            <section className="stack" style={{ "--gap": "14px" }}>
              <article className="course-card">
                <div className="spread" style={{ alignItems: "start", flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ fontSize: "var(--step-1)" }}>{courseLabel(t, course)}</h2>
                    <p className="faint">
                      {t("home.started", { date: fmtDate(course.started_at, { day: "numeric", month: "long" }) })}
                    </p>
                  </div>
                  {!confirmFinish && (
                    <button className="btn btn-small btn-ghost" onClick={() => setConfirmFinish(true)}>{t("home.finish")}</button>
                  )}
                </div>
                <blockquote className="their-words">
                  <span className="faint">{t("home.inwords")}</span>
                  <p>{course.description}</p>
                </blockquote>
                {confirmFinish && (
                  <div className="confirm-row">
                    <span>{t("home.finish.confirm")}</span>
                    <div className="row">
                      <button className="btn btn-small" onClick={finishCourse}>{t("home.finish.yes")}</button>
                      <button className="btn btn-small btn-ghost" onClick={() => setConfirmFinish(false)}>{t("common.cancel")}</button>
                    </div>
                  </div>
                )}
              </article>

              <h2 style={{ fontSize: "var(--step-1)", marginTop: 10 }}>{t("home.today")}</h2>
              {plans.map((p) => (
                <article className="exercise-card" key={p.id}>
                  <ExerciseArt id={p.exercise_id} />
                  <div>
                    <h3>{t(`ex.${p.exercise_id}.name`)}</h3>
                    <div className="meta">
                      <span className="chip">{t("home.reps", { reps: p.reps, sets: p.sets })}</span>
                      <span className="chip chip-marigold">{t("home.target", { n: Math.round(p.target_rom) })}</span>
                      <span className="chip">{t(`camera.${p.camera_view}`)}</span>
                    </div>
                    <div className="spread" style={{ flexWrap: "wrap" }}>
                      {p.done_today ? (
                        <span className="done-check">
                          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
                          {t("home.donetoday")}
                        </span>
                      ) : p.last ? (
                        <span className="row faint" style={{ gap: 6 }}>{t("home.lasttime")} <Stars count={p.last.stars || 0} size={16} /></span>
                      ) : <span className="faint">{t("home.firsttime")}</span>}
                      <Link to={`/play/${course.id}/${p.exercise_id}`} className={`btn btn-small ${p.done_today ? "btn-ghost" : "btn-marigold"}`}>
                        {p.done_today ? t("home.again") : t("home.start")}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}

              {notInPlan.length > 0 && (
                <div className="panel-flat row" style={{ flexWrap: "wrap" }}>
                  <span className="muted">{t("home.add")}</span>
                  {notInPlan.map((id) => (
                    <button key={id} className="btn btn-small btn-ghost" onClick={() => addExercise(id)}>+ {t(`ex.${id}.name`)}</button>
                  ))}
                </div>
              )}
              {error && <div className="error">{error}</div>}

            </section>

            <aside className="stack" style={{ "--gap": "18px" }}>
              <section className="panel stack" style={{ "--gap": "12px" }}>
                <div className="spread">
                  <h2 style={{ fontSize: "var(--step-1)" }}>{t("cal.title")}</h2>
                  <span className="faint">{t("cal.weeks4")}</span>
                </div>
                <PracticeCalendar days={calendar} />
                <div className="stat-line">
                  <span className="big">{g.streak}</span>
                  <span className="muted">{t("cal.streak")}</span>
                </div>
                <p className="faint">{t("cal.days", { n: practised, total: calendar.length })}</p>
                {g.freezes > 0 && <p className="faint">{t("cal.freeze")}</p>}
              </section>

              <section className="panel stack" style={{ "--gap": "10px" }}>
                <div className="spread">
                  <h2 style={{ fontSize: "var(--step-1)" }}>{t("level.title", { n: g.level })}</h2>
                  <span className="num">{t("level.xp", { n: g.xp })}</span>
                </div>
                <ThreadMeter progress={g.level_progress} />
                <p className="faint">{t("level.next", { n: g.xp_to_next, next: g.level + 1 })}</p>
              </section>

              {badges.length > 0 && (
                <section className="panel stack" style={{ "--gap": "12px" }}>
                  <h2 style={{ fontSize: "var(--step-1)" }}>{t("badges.title")}</h2>
                  <ul className="badge-list">
                    {badges.slice(0, 6).map((b) => (
                      <li className="badge-item" key={b.badge}>
                        <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><Tile cx={17} cy={17} r={15} /></svg>
                        <span>{t(`badge.${b.badge}`)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
