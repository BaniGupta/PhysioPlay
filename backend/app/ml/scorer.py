"""Rep scoring.

1. If a trained model for this exercise exists in backend/models/, it judges FORM
   (probability that the rep is "galat" / incorrect).
2. Otherwise a rule-based backup judges form.

Final rep score = 60% form + 40% range (range = how close the patient got to
THEIR OWN target, so a patient with a broken arm is not compared to anyone else).
"""
import glob
import json
import os

import numpy as np

from .features import DEFAULT_MODEL_ANGLES, make_feature_row, make_sequence, rep_signals

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")

# Which angles each kind of movement needs.
NEEDS = {
    "elbow_flexion": ["elbow", "shoulder", "trunk"],
    "shoulder": ["elbow", "shoulder", "trunk"],
    "knee_flexion": ["knee", "hip", "trunk"],
    "knee_extension": ["knee", "hip", "trunk"],
    "side_bend": ["trunk_side", "trunk"],
}

_models = {}


def load_models():
    """Read every *_meta.json in backend/models and load the model it points to."""
    _models.clear()
    for meta_path in glob.glob(os.path.join(MODELS_DIR, "*_meta.json")):
        try:
            with open(meta_path) as fh:
                meta = json.load(fh)
            model_path = os.path.join(MODELS_DIR, meta["model_file"])
            kind = meta.get("model_type", "xgboost")
            if kind in ("xgboost", "randomforest", "sklearn"):
                import joblib
                model = joblib.load(model_path)
            elif kind == "gru":
                from tensorflow import keras  # only needed if you use the GRU
                model = keras.models.load_model(model_path)
            else:
                print(f"[models] unknown model_type {kind} in {meta_path}")
                continue
            _models[meta["exercise"]] = {"meta": meta, "model": model, "kind": kind}
            print(f"[models] loaded {meta['model_file']} for {meta['exercise']}")
        except Exception as exc:  # a broken model file must never crash the app
            print(f"[models] could not load {meta_path}: {exc}")
    return loaded_models()


def loaded_models():
    return {k: v["meta"]["model_file"] for k, v in _models.items()}


def primary_series(primary_angle, s):
    """Degrees moved, per frame, for the movement that matters in this exercise."""
    if primary_angle == "elbow_flexion":
        return 180.0 - s["elbow"]
    if primary_angle == "shoulder":
        return s["shoulder"]
    if primary_angle == "knee_flexion":
        return 180.0 - s["knee"]
    if primary_angle == "knee_extension":
        return np.clip(s["knee"] - 90.0, 0, None)
    if primary_angle == "side_bend":
        return s["trunk_side"]
    raise ValueError(primary_angle)


def missing_angles(primary_angle, frames):
    return [a for a in NEEDS[primary_angle] if a not in frames[0]]


def _p_galat_from_model(entry, signals):
    meta, model, kind = entry["meta"], entry["model"], entry["kind"]
    angles = meta.get("angles", DEFAULT_MODEL_ANGLES)
    if kind == "gru":
        seq = make_sequence(signals, angles)[None, ...]
        return float(model.predict(seq, verbose=0).ravel()[0])
    import pandas as pd
    row = make_feature_row(signals, angles)
    cols = meta.get("features") or list(row.keys())
    X = pd.DataFrame([[row[c] for c in cols]], columns=cols)
    return float(model.predict_proba(X)[0][1])


# ---------- rule-based backup (used until a model is dropped into models/) ----------
FLAG_PENALTY = {
    "trunk_lean": 25,       # leaning the body to cheat the movement
    "chest_down": 20,       # squat: chest dropping too far forward
    "elbow_bent": 15,       # elbow should stay straight in shoulder exercises
    "upper_arm_moved": 15,  # upper arm should stay still in elbow exercises
    "too_fast": 10,
    "partial": 10,
}


def _rule_form_score(primary, flags):
    score = 100.0
    for flag in flags:
        score -= FLAG_PENALTY.get(flag, 10)
    jerk = np.abs(np.diff(primary, n=3)).mean()
    score -= min(15.0, jerk * 1.5)
    return float(np.clip(score, 0, 100))


def score_rep(exercise, plan_target, frames, flags, duration):
    signals = rep_signals(frames)
    primary = primary_series(exercise["primary_angle"], signals)
    rom = float(primary.max())
    range_score = float(np.clip(rom / max(plan_target, 1.0), 0, 1) * 100)

    entry = _models.get(exercise["id"])
    if entry and all(a in signals for a in entry["meta"].get("angles", DEFAULT_MODEL_ANGLES)):
        p_galat = _p_galat_from_model(entry, signals)
        # Mistakes the browser saw (trunk lean, elbow bent, ...) always count, even if the model
        # thinks the rep looks fine: the final form score is the lower of the two.
        form_score = min((1 - p_galat) * 100, _rule_form_score(primary, flags))
        if "trunk_lean" in flags:          # safety rule on top of the model
            form_score = min(form_score, 60)
        scored_by = entry["meta"]["model_file"]
    else:
        p_galat = None
        form_score = _rule_form_score(primary, flags)
        scored_by = "rules"

    score = 0.6 * form_score + 0.4 * range_score
    trace = {a: [round(float(v), 1) for v in signals[a]] for a in signals}
    return {
        "rom": round(rom, 1),
        "form_score": round(form_score, 1),
        "range_score": round(range_score, 1),
        "score": round(score, 1),
        "p_galat": None if p_galat is None else round(p_galat, 3),
        "scored_by": scored_by,
        "duration": round(float(duration), 2),
        "trace": trace,
    }
