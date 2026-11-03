"""Exercises + demo accounts with a few weeks of history (so graphs are not empty on demo day).

Demo logins (name / PIN):
    Riya Sharma      / 1111   patient: elbow plan, 3+ weeks of steady progress
    Aman Gill        / 2222   patient: shoulder plan, new
    Harjeet Singh    / 3333   patient: finished an elbow plan earlier, now a knee plan
"""
import random
from datetime import datetime, timedelta

from .auth import hash_pin
from .db import get_db, row

# primary_angle = which movement drives the game and the range score (see ml/scorer.py)
EXERCISES = [
    # id                  area        camera   primary          target max  reps game
    ("elbow_flexion",      "arm",      "side",  "elbow_flexion",  90, 145, 10, "hand_pump"),
    ("shoulder_abduction", "shoulder", "front", "shoulder",       90, 170, 10, "bird_flight"),
    ("shoulder_flexion",   "shoulder", "side",  "shoulder",       90, 170, 10, "bird_flight"),
    ("squat",              "leg",      "side",  "knee_flexion",   60, 110, 8,  "balloon_pop"),
    ("sit_to_stand",       "leg",      "side",  "knee_extension", 75, 90,  8,  "hand_pump"),
    ("knee_extension",     "leg",      "side",  "knee_extension", 70, 90,  10, "bird_flight"),
    ("side_bend",          "back",     "front", "side_bend",      20, 40,  8,  "balloon_pop"),
]


def _ensure_user(db, name, pin):
    u = row(db.execute("SELECT id FROM users WHERE name = ?", (name,)))
    if u:
        return u["id"], False
    cur = db.execute("INSERT INTO users (name, pin_hash, role) VALUES (?, ?, 'patient')", (name, hash_pin(pin)))
    return cur.lastrowid, True


def _course(db, pid, area, side, text, pain, started_days_ago, ended_days_ago=None):
    now = datetime.now()
    cur = db.execute(
        """INSERT INTO courses (patient_id, body_area, side, description, baseline_pain, status,
                                started_at, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (pid, area, side, text, pain, "completed" if ended_days_ago is not None else "active",
         (now - timedelta(days=started_days_ago)).isoformat(timespec="seconds"),
         None if ended_days_ago is None else (now - timedelta(days=ended_days_ago)).isoformat(timespec="seconds")))
    return cur.lastrowid


def _plan(db, cid, ex_id, target):
    ex = next(e for e in EXERCISES if e[0] == ex_id)
    db.execute("INSERT INTO plans (course_id, exercise_id, reps, sets, target_rom, max_rom) VALUES (?, ?, ?, 2, ?, ?)",
               (cid, ex_id, ex[6], target, ex[5]))
    # No saved calibration: the first game always measures the real person's own range.


def _history(db, pid, cid, ex_id, days, t0, t1, rng, pain_last=None):
    today = datetime.now().replace(hour=18, minute=0, second=0, microsecond=0)
    n = len(days)
    for i, d in enumerate(days):
        frac = i / max(n - 1, 1)
        rom = (t0 + (t1 - t0) * frac) * rng.uniform(0.88, 1.04)
        avg = min(97, 62 + 28 * frac + rng.uniform(-6, 6))
        pain = pain_last if (pain_last is not None and i == n - 1) else 2
        started = today - timedelta(days=d, minutes=rng.randint(0, 600))
        db.execute(
            """INSERT INTO sessions (course_id, patient_id, exercise_id, game, started_at, ended_at, pain, reps_done,
                                     avg_score, best_rom, stars, xp_earned)
               VALUES (?, ?, ?, ?, ?, ?, ?, 16, ?, ?, ?, ?)""",
            (cid, pid, ex_id, "bird_flight", started.isoformat(timespec="seconds"),
             (started + timedelta(minutes=8)).isoformat(timespec="seconds"), pain, round(avg, 1), round(rom, 1),
             3 if avg >= 85 else 2 if avg >= 65 else 1, int(16 * avg / 10) + 20))


def seed():
    rng = random.Random(7)
    with get_db() as db:
        for e in EXERCISES:
            db.execute("""INSERT OR REPLACE INTO exercises (id, body_area, camera_view, primary_angle, default_target,
                                                            max_safe, default_reps, default_game)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", e)

        # ---- Riya: one active elbow plan, 24 days in a row
        riya, created = _ensure_user(db, "Riya Sharma", "1111")
        if created:
            c = _course(db, riya, "arm", "right",
                        "Fractured my right forearm near the elbow. The cast came off 6 weeks ago and I still "
                        "can't bend the elbow fully, it feels stiff in the mornings.", 4, 26)
            _plan(db, c, "elbow_flexion", 95)
            _history(db, riya, c, "elbow_flexion", list(range(24, 0, -1)), 75, 95, rng)
            db.execute("INSERT INTO gamification (patient_id, xp, streak, longest_streak, last_day) "
                       "VALUES (?, 4140, 24, 24, date('now','-1 day'))", (riya,))
            for b in ["first_session", "streak_3", "streak_7", "ten_sessions", "new_best"]:
                db.execute("INSERT INTO badges (patient_id, badge) VALUES (?, ?)", (riya, b))

        # ---- Aman: new shoulder plan
        aman, created = _ensure_user(db, "Aman Gill", "2222")
        if created:
            c = _course(db, aman, "shoulder", "left",
                        "Sprained my left shoulder playing cricket. Pain on the outer side when I lift my arm "
                        "above shoulder height.", 5, 10)
            _plan(db, c, "shoulder_abduction", 110)
            _history(db, aman, c, "shoulder_abduction", [9, 8, 6, 5, 3, 2, 1], 85, 110, rng)
            db.execute("INSERT INTO gamification (patient_id, xp, streak, longest_streak, last_day) "
                       "VALUES (?, 1218, 2, 3, date('now','-1 day'))", (aman,))
            for b in ["first_session", "streak_3"]:
                db.execute("INSERT INTO badges (patient_id, badge) VALUES (?, ?)", (aman, b))

        # ---- Harjeet: earlier arm plan (finished), now a knee plan — one account, two problems
        harjeet, created = _ensure_user(db, "Harjeet Singh", "3333")
        if created:
            old = _course(db, harjeet, "arm", "right",
                          "Tennis elbow in my right arm from lifting heavy boxes at work.", 5, 70, 38)
            _plan(db, old, "elbow_flexion", 110)
            _history(db, harjeet, old, "elbow_flexion", list(range(68, 40, -2)), 85, 110, rng)

            knee = _course(db, harjeet, "leg", "left",
                           "Left knee pain after a fall on the stairs. It hurts on the inner side of the knee when "
                           "I climb stairs or get up from a chair, and it swells a little in the evening.", 6, 18)
            _plan(db, knee, "squat", 55)
            _plan(db, knee, "knee_extension", 70)
            _history(db, harjeet, knee, "squat", [16, 13, 10, 8, 5], 40, 50, rng, pain_last=7)
            _history(db, harjeet, knee, "knee_extension", [15, 12, 9, 6], 55, 66, rng)
            db.execute("INSERT INTO gamification (patient_id, xp, streak, longest_streak, last_day) "
                       "VALUES (?, 2650, 0, 6, date('now','-5 day'))", (harjeet,))
            for b in ["first_session", "streak_3", "ten_sessions"]:
                db.execute("INSERT INTO badges (patient_id, badge) VALUES (?, ?)", (harjeet, b))
