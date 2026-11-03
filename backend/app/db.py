"""SQLite database: connection helper + schema.

Video is never stored. Only numbers (angles, scores) and per-rep angle traces.

A patient can have many recovery plans ("courses"): e.g. an arm plan last year
and a knee plan now. Exercises, sessions and calibration belong to a plan.
"""
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get("PHYSIO_DB", os.path.join(os.path.dirname(os.path.dirname(__file__)), "physioplay.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient')),
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'pa')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);

-- One recovery plan = one problem (e.g. "left knee after surgery").
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES users(id),
    body_area TEXT NOT NULL CHECK (body_area IN ('shoulder', 'arm', 'leg', 'back')),
    side TEXT NOT NULL CHECK (side IN ('left', 'right', 'none')),
    description TEXT NOT NULL,                  -- the patient's own words, any length up to 1000
    baseline_pain INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
);

CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    body_area TEXT NOT NULL,
    camera_view TEXT NOT NULL,
    primary_angle TEXT NOT NULL,                -- which movement drives the game
    default_target REAL NOT NULL,
    max_safe REAL NOT NULL,
    default_reps INTEGER NOT NULL,
    default_game TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    reps INTEGER NOT NULL DEFAULT 10,
    sets INTEGER NOT NULL DEFAULT 2,
    target_rom REAL NOT NULL,
    max_rom REAL NOT NULL,
    per_week INTEGER NOT NULL DEFAULT 5,
    auto_progress INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS calibrations (
    course_id INTEGER NOT NULL REFERENCES courses(id),
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    min_angle REAL NOT NULL,
    max_angle REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (course_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    patient_id INTEGER NOT NULL REFERENCES users(id),
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    game TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    pain INTEGER,
    reps_done INTEGER NOT NULL DEFAULT 0,
    avg_score REAL,
    best_rom REAL,
    stars INTEGER,
    xp_earned INTEGER
);

CREATE TABLE IF NOT EXISTS reps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    rep_no INTEGER NOT NULL,
    rom REAL NOT NULL,                          -- degrees moved in this rep
    duration REAL NOT NULL,
    form_flags TEXT,                            -- comma separated rule flags from the browser
    form_score REAL NOT NULL,
    range_score REAL NOT NULL,
    score REAL NOT NULL,
    scored_by TEXT NOT NULL,                    -- 'rules' or model file name
    p_galat REAL,
    trace TEXT                                  -- JSON: 60-frame angle traces (for replay / re-scoring)
);

CREATE TABLE IF NOT EXISTS gamification (
    patient_id INTEGER PRIMARY KEY REFERENCES users(id),
    xp INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_day TEXT,
    freezes INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS badges (
    patient_id INTEGER NOT NULL REFERENCES users(id),
    badge TEXT NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (patient_id, badge)
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript(SCHEMA)


def rows(cursor):
    return [dict(r) for r in cursor.fetchall()]


def row(cursor):
    r = cursor.fetchone()
    return dict(r) if r else None
