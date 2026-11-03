"""PhysioPlay — backend API.

Run:  uvicorn app.main:app --reload --port 8000     (from the backend/ folder)
Docs: http://localhost:8000/docs
"""
import json
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import gamify
from .auth import current_user, fail, hash_pin, new_token, patient_user
from .db import get_db, init_db, row, rows
from .ml import scorer
from .seed import seed

app = FastAPI(title="PhysioPlay API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    init_db()
    seed()
    loaded = scorer.load_models()
    print(f"[startup] ML models: {loaded or 'none yet — using rule-based scoring'}")


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


# =================================================================== auth
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    pin: str = Field(pattern=r"^\d{4}$")
    language: str = Field(default="en", pattern="^(en|hi|pa)$")


class LoginIn(BaseModel):
    name: str
    pin: str


class MeIn(BaseModel):
    language: str = Field(pattern="^(en|hi|pa)$")


def _user(uid):
    with get_db() as db:
        return row(db.execute("SELECT id, name, role, language FROM users WHERE id = ?", (uid,)))


@app.post("/auth/register")
def register(body: RegisterIn):
    name = body.name.strip()
    with get_db() as db:
        if row(db.execute("SELECT id FROM users WHERE name = ?", (name,))):
            fail(409, "name_taken", "That name is already taken. Add a surname or initial.")
        uid = db.execute("INSERT INTO users (name, pin_hash, role, language) VALUES (?, ?, 'patient', ?)",
                         (name, hash_pin(body.pin), body.language)).lastrowid
        db.execute("INSERT INTO gamification (patient_id) VALUES (?)", (uid,))
    return {"token": new_token(uid), "user": _user(uid)}


@app.post("/auth/login")
def login(body: LoginIn):
    with get_db() as db:
        u = row(db.execute("SELECT id, pin_hash FROM users WHERE name = ?", (body.name.strip(),)))
    if not u or u["pin_hash"] != hash_pin(body.pin):
        fail(401, "bad_login", "Name or PIN doesn't match. Check both and try again.")
    return {"token": new_token(u["id"]), "user": _user(u["id"])}


@app.get("/auth/me")
def me(user=Depends(current_user)):
    return user


@app.put("/auth/me")
def update_me(body: MeIn, user=Depends(current_user)):
    with get_db() as db:
        db.execute("UPDATE users SET language=? WHERE id=?", (body.language, user["id"]))
    return _user(user["id"])


@app.get("/exercises")
def exercises():
    with get_db() as db:
        return rows(db.execute("SELECT * FROM exercises"))


# =================================================================== helpers
def _exercise(db, ex_id):
    ex = row(db.execute("SELECT * FROM exercises WHERE id = ?", (ex_id,)))
    if not ex:
        fail(404, "exercise_unknown", "Unknown exercise.")
    return ex


def _my_course(db, course_id, patient_id):
    c = row(db.execute("SELECT * FROM courses WHERE id=? AND patient_id=?", (course_id, patient_id)))
    if not c:
        fail(404, "course_not_found", "Recovery plan not found.")
    return c


def _add_plan(db, course_id, ex):
    if row(db.execute("SELECT id FROM plans WHERE course_id=? AND exercise_id=? AND active=1", (course_id, ex["id"]))):
        fail(409, "plan_exists", "This exercise is already in the plan.")
    db.execute("INSERT INTO plans (course_id, exercise_id, reps, target_rom, max_rom) VALUES (?, ?, ?, ?, ?)",
               (course_id, ex["id"], ex["default_reps"], ex["default_target"], ex["max_safe"]))


def _gami(db, pid):
    g = row(db.execute("SELECT * FROM gamification WHERE patient_id = ?", (pid,))) or \
        {"xp": 0, "streak": 0, "longest_streak": 0, "last_day": None, "freezes": 1}
    if g["last_day"]:
        gap = (date.today() - date.fromisoformat(g["last_day"])).days
        if gap > 2 or (gap == 2 and g["freezes"] == 0):
            g["streak"] = 0
    return {
        "xp": g["xp"], "level": gamify.level_for(g["xp"]),
        "level_progress": (g["xp"] % gamify.XP_PER_LEVEL) / gamify.XP_PER_LEVEL,
        "xp_to_next": gamify.XP_PER_LEVEL - g["xp"] % gamify.XP_PER_LEVEL,
        "streak": g["streak"], "longest_streak": g["longest_streak"], "freezes": g["freezes"],
    }


def _calendar(db, pid, days=28, course_id=None):
    start = date.today() - timedelta(days=days - 1)
    q = """SELECT date(started_at) d, COUNT(*) n FROM sessions
           WHERE patient_id=? AND ended_at IS NOT NULL AND date(started_at) >= ?"""
    args = [pid, start.isoformat()]
    if course_id:
        q += " AND course_id=?"
        args.append(course_id)
    counts = {r["d"]: r["n"] for r in rows(db.execute(q + " GROUP BY d", args))}
    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        out.append({"date": d, "sessions": counts.get(d, 0)})
    return out


def _course_summary(db, c):
    c = dict(c)
    c["exercises"] = [r["exercise_id"] for r in rows(db.execute(
        "SELECT exercise_id FROM plans WHERE course_id=? AND active=1", (c["id"],)))]
    c["sessions"] = db.execute("SELECT COUNT(*) FROM sessions WHERE course_id=? AND ended_at IS NOT NULL",
                               (c["id"],)).fetchone()[0]
    c["last_session"] = db.execute("SELECT MAX(started_at) FROM sessions WHERE course_id=? AND ended_at IS NOT NULL",
                                   (c["id"],)).fetchone()[0]
    return c


# =================================================================== patient: recovery plans (courses)
class CourseIn(BaseModel):
    body_area: str = Field(pattern="^(shoulder|arm|leg|back)$")
    side: str = Field(pattern="^(left|right|none)$")
    description: str = Field(min_length=2, max_length=1000)
    baseline_pain: int = Field(ge=0, le=10)
    exercise_ids: List[str] = Field(min_length=1)


class AddPlanIn(BaseModel):
    exercise_id: str


@app.get("/courses")
def list_courses(user=Depends(patient_user)):
    with get_db() as db:
        cs = rows(db.execute("SELECT * FROM courses WHERE patient_id=? ORDER BY status='completed', started_at DESC",
                             (user["id"],)))
        return [_course_summary(db, c) for c in cs]


@app.post("/courses")
def create_course(body: CourseIn, user=Depends(patient_user)):
    with get_db() as db:
        cid = db.execute(
            "INSERT INTO courses (patient_id, body_area, side, description, baseline_pain) VALUES (?, ?, ?, ?, ?)",
            (user["id"], body.body_area, body.side, body.description.strip(), body.baseline_pain)
        ).lastrowid
        for ex_id in dict.fromkeys(body.exercise_ids):
            _add_plan(db, cid, _exercise(db, ex_id))
        return _course_summary(db, row(db.execute("SELECT * FROM courses WHERE id=?", (cid,))))


@app.post("/courses/{course_id}/complete")
def complete_course(course_id: int, user=Depends(patient_user)):
    with get_db() as db:
        _my_course(db, course_id, user["id"])
        db.execute("UPDATE courses SET status='completed', ended_at=? WHERE id=?", (now_iso(), course_id))
    return {"ok": True}


@app.post("/courses/{course_id}/plans")
def patient_add_plan(course_id: int, body: AddPlanIn, user=Depends(patient_user)):
    with get_db() as db:
        _my_course(db, course_id, user["id"])
        _add_plan(db, course_id, _exercise(db, body.exercise_id))
    return {"ok": True}


@app.get("/home")
def home(course_id: Optional[int] = None, user=Depends(patient_user)):
    pid = user["id"]
    today = date.today().isoformat()
    with get_db() as db:
        courses = [_course_summary(db, c) for c in rows(db.execute(
            "SELECT * FROM courses WHERE patient_id=? ORDER BY status='completed', started_at DESC", (pid,)))]
        active = [c for c in courses if c["status"] == "active"]
        course = next((c for c in courses if c["id"] == course_id), None) or (active[0] if active else None)
        plans = []
        if course:
            plans = rows(db.execute(
                """SELECT pl.*, e.body_area, e.camera_view, e.primary_angle, e.default_game
                   FROM plans pl JOIN exercises e ON e.id = pl.exercise_id
                   WHERE pl.course_id = ? AND pl.active = 1""", (course["id"],)))
            for p in plans:
                p["done_today"] = db.execute(
                    """SELECT COUNT(*) FROM sessions WHERE course_id=? AND exercise_id=?
                       AND ended_at IS NOT NULL AND date(started_at)=?""",
                    (course["id"], p["exercise_id"], today)).fetchone()[0]
                p["last"] = row(db.execute(
                    """SELECT best_rom, avg_score, stars FROM sessions WHERE course_id=? AND exercise_id=?
                       AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1""",
                    (course["id"], p["exercise_id"])))
        badges = rows(db.execute("SELECT badge, earned_at FROM badges WHERE patient_id=? ORDER BY earned_at DESC",
                                 (pid,)))
        return {"name": user["name"], "courses": courses, "course": course, "plans": plans,
                "gamification": _gami(db, pid), "calendar": _calendar(db, pid), "badges": badges}


@app.get("/progress")
def progress(course_id: Optional[int] = None, user=Depends(patient_user)):
    pid = user["id"]
    with get_db() as db:
        courses = [_course_summary(db, c) for c in rows(db.execute(
            "SELECT * FROM courses WHERE patient_id=? ORDER BY status='completed', started_at DESC", (pid,)))]
        course = next((c for c in courses if c["id"] == course_id), None) or (courses[0] if courses else None)
        out = []
        if course:
            for p in rows(db.execute("SELECT * FROM plans WHERE course_id=? AND active=1", (course["id"],))):
                series = rows(db.execute(
                    """SELECT date(started_at) date, best_rom, avg_score, stars, pain FROM sessions
                       WHERE course_id=? AND exercise_id=? AND ended_at IS NOT NULL ORDER BY started_at""",
                    (course["id"], p["exercise_id"])))
                p["series"] = series
                p["first_rom"] = series[0]["best_rom"] if series else None
                p["best_rom"] = max((s["best_rom"] or 0 for s in series), default=None)
                out.append(p)
        return {"courses": courses, "course": course, "exercises": out,
                "calendar": _calendar(db, pid, 56), "gamification": _gami(db, pid)}


# =================================================================== calibration
class CalibrationIn(BaseModel):
    min_angle: float = Field(ge=0, le=180)
    max_angle: float = Field(ge=0, le=180)


@app.put("/courses/{course_id}/calibration/{exercise_id}")
def put_calibration(course_id: int, exercise_id: str, body: CalibrationIn, user=Depends(patient_user)):
    if body.max_angle - body.min_angle < 8:
        fail(422, "range_too_small", "The range is too small. Try the comfortable movement again, a little further.")
    with get_db() as db:
        _my_course(db, course_id, user["id"])
        db.execute("""INSERT INTO calibrations (course_id, exercise_id, min_angle, max_angle, updated_at)
                      VALUES (?, ?, ?, ?, datetime('now'))
                      ON CONFLICT(course_id, exercise_id)
                      DO UPDATE SET min_angle=excluded.min_angle, max_angle=excluded.max_angle,
                                    updated_at=excluded.updated_at""",
                   (course_id, exercise_id, body.min_angle, body.max_angle))
    return {"ok": True}


# =================================================================== sessions
class SessionIn(BaseModel):
    course_id: int
    exercise_id: str


class RepIn(BaseModel):
    rep_no: int
    frames: List[Dict[str, float]] = Field(min_length=3)
    flags: List[str] = []
    duration: float


class CompleteIn(BaseModel):
    pain: int = Field(ge=0, le=10)
    game: Optional[str] = None


def _session_ctx(db, session_id, pid):
    s = row(db.execute("SELECT * FROM sessions WHERE id=? AND patient_id=?", (session_id, pid)))
    if not s:
        fail(404, "session_not_found", "Session not found.")
    ex = _exercise(db, s["exercise_id"])
    plan = row(db.execute("SELECT * FROM plans WHERE course_id=? AND exercise_id=? AND active=1",
                          (s["course_id"], s["exercise_id"])))
    return s, ex, plan


@app.post("/sessions")
def start_session(body: SessionIn, user=Depends(patient_user)):
    with get_db() as db:
        course = _my_course(db, body.course_id, user["id"])
        if course["status"] != "active":
            fail(409, "course_finished", "This recovery plan is finished. Start a new plan to keep going.")
        ex = _exercise(db, body.exercise_id)
        plan = row(db.execute("SELECT * FROM plans WHERE course_id=? AND exercise_id=? AND active=1",
                              (course["id"], ex["id"])))
        if not plan:
            _add_plan(db, course["id"], ex)
            plan = row(db.execute("SELECT * FROM plans WHERE course_id=? AND exercise_id=? AND active=1",
                                  (course["id"], ex["id"])))
        cal = row(db.execute("SELECT * FROM calibrations WHERE course_id=? AND exercise_id=?", (course["id"], ex["id"])))
        sid = db.execute("INSERT INTO sessions (course_id, patient_id, exercise_id, started_at) VALUES (?, ?, ?, ?)",
                         (course["id"], user["id"], ex["id"], now_iso())).lastrowid
        return {"session_id": sid, "exercise": ex, "plan": plan, "calibration": cal,
                "side": course["side"] if course["side"] != "none" else "right",
                "model": scorer.loaded_models().get(ex["id"])}


@app.post("/sessions/{session_id}/reps")
def add_rep(session_id: int, body: RepIn, user=Depends(patient_user)):
    with get_db() as db:
        s, ex, plan = _session_ctx(db, session_id, user["id"])
        if s["ended_at"]:
            fail(409, "session_finished", "This session is already finished.")
        missing = scorer.missing_angles(ex["primary_angle"], body.frames)
        if missing:
            fail(422, "angles_missing", f"Frames are missing angles: {', '.join(missing)}")
        result = scorer.score_rep(ex, plan["target_rom"], body.frames, body.flags, body.duration)
        db.execute(
            """INSERT INTO reps (session_id, rep_no, rom, duration, form_flags, form_score, range_score,
                                 score, scored_by, p_galat, trace)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, body.rep_no, result["rom"], result["duration"], ",".join(body.flags),
             result["form_score"], result["range_score"], result["score"], result["scored_by"],
             result["p_galat"], json.dumps(result["trace"])))
        result.pop("trace")
        result["flags"] = body.flags
        return result


@app.post("/sessions/{session_id}/complete")
def complete_session(session_id: int, body: CompleteIn, user=Depends(patient_user)):
    pid = user["id"]
    with get_db() as db:
        s, ex, plan = _session_ctx(db, session_id, pid)
        if s["ended_at"]:
            fail(409, "session_finished", "This session is already finished.")
        reps = rows(db.execute("SELECT * FROM reps WHERE session_id=? ORDER BY rep_no", (session_id,)))
        scores = [r["score"] for r in reps]
        avg = sum(scores) / len(scores) if scores else 0
        best_rom = max((r["rom"] for r in reps), default=0)
        stars = gamify.stars_for(avg) if reps else 0
        xp = gamify.xp_for(scores) if reps else 0
        prev_best = db.execute(
            "SELECT MAX(best_rom) FROM sessions WHERE course_id=? AND exercise_id=? AND ended_at IS NOT NULL",
            (s["course_id"], ex["id"])).fetchone()[0]
        db.execute("""UPDATE sessions SET ended_at=?, pain=?, reps_done=?, avg_score=?, best_rom=?, stars=?,
                      xp_earned=?, game=? WHERE id=?""",
                   (now_iso(), body.pain, len(reps), round(avg, 1), best_rom, stars, xp, body.game, session_id))

        g = row(db.execute("SELECT * FROM gamification WHERE patient_id=?", (pid,)))
        level_before = gamify.level_for(g["xp"])
        if reps:
            g = gamify.update_streak(g, date.today())
            g["xp"] += xp
        db.execute("UPDATE gamification SET xp=?, streak=?, longest_streak=?, last_day=?, freezes=? WHERE patient_id=?",
                   (g["xp"], g["streak"], g["longest_streak"], g["last_day"], g["freezes"], pid))

        new_badges = []

        def award(b):
            if db.execute("INSERT OR IGNORE INTO badges (patient_id, badge) VALUES (?, ?)", (pid, b)).rowcount:
                new_badges.append(b)

        if reps:
            award("first_session")
            if g["streak"] >= 3:
                award("streak_3")
            if g["streak"] >= 7:
                award("streak_7")
            if len(scores) >= 5 and all(sc >= 85 for sc in scores):
                award("perfect_set")
            if prev_best is not None and best_rom > prev_best:
                award("new_best")
            if db.execute("SELECT COUNT(*) FROM sessions WHERE patient_id=? AND ended_at IS NOT NULL",
                          (pid,)).fetchone()[0] >= 10:
                award("ten_sessions")

        recent = rows(db.execute(
            """SELECT avg_score, best_rom, pain FROM sessions WHERE course_id=? AND exercise_id=?
               AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 3""", (s["course_id"], ex["id"])))
        new_target, reason = gamify.next_target(plan, recent)
        if reason:
            db.execute("UPDATE plans SET target_rom=? WHERE id=?", (new_target, plan["id"]))
        return {
            "reps": len(reps), "avg_score": round(avg, 1), "best_rom": best_rom, "stars": stars,
            "xp": xp, "total_xp": g["xp"], "level": gamify.level_for(g["xp"]),
            "level_up": gamify.level_for(g["xp"]) > level_before,
            "streak": g["streak"], "new_badges": new_badges,
            "previous_best": prev_best, "target": plan["target_rom"],
            "target_change": None if not reason else {"reason": reason, "new_target": new_target},
        }


# =================================================================== ML models
@app.get("/models")
def models():
    return {"loaded": scorer.loaded_models()}


@app.post("/models/reload")
def reload_models():
    return {"loaded": scorer.load_models()}
