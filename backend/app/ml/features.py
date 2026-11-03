"""Feature code — MUST stay identical to the Colab notebook.

Every frame from the website carries these angles (degrees), computed from
MediaPipe in the browser (frontend/src/pose/angles.js):

    elbow      = shoulder - elbow - wrist      (180 = arm straight)
    shoulder   = hip - shoulder - elbow        (0 = arm down by the side)
    trunk      = spine vs. vertical            (0 = standing straight)
    trunk_side = spine vs. vertical, side-to-side only
    knee       = hip - knee - ankle            (180 = leg straight)
    hip        = shoulder - hip - knee         (180 = standing straight)

The arm models trained in Colab use ["elbow", "shoulder", "trunk"] (written in
each model's meta.json). Training recordings were resampled to 60 frames, so
every rep from the website is resampled to 60 frames too.
"""
import numpy as np

N_FRAMES = 60
DEFAULT_MODEL_ANGLES = ["elbow", "shoulder", "trunk"]


def resample(sig, n=N_FRAMES):
    """Stretch / shrink a 1-D signal to exactly n frames (linear interpolation)."""
    sig = np.asarray(sig, dtype=float)
    if len(sig) == 0:
        return np.zeros(n)
    if len(sig) == 1:
        return np.full(n, sig[0])
    return np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(sig)), sig)


def summary(sig, p):
    """Same 'report card' as Colab Step C."""
    sig = np.asarray(sig, dtype=float)
    vel = np.diff(sig)
    jerk = np.diff(sig, n=3)
    return {
        f"{p}_min": sig.min(),
        f"{p}_max": sig.max(),
        f"{p}_range": sig.max() - sig.min(),
        f"{p}_mean": sig.mean(),
        f"{p}_std": sig.std(),
        f"{p}_speed_max": np.abs(vel).max() if len(vel) else 0.0,
        f"{p}_speed_std": vel.std() if len(vel) else 0.0,
        f"{p}_jerk": np.abs(jerk).mean() if len(jerk) else 0.0,
    }


def rep_signals(frames):
    """frames: list of {"elbow": .., "knee": .., ...} -> dict of 60-frame arrays (one per angle)."""
    keys = set(frames[0].keys())
    for f in frames[1:]:
        keys &= set(f.keys())
    return {k: resample([f[k] for f in frames]) for k in sorted(keys)}


def make_feature_row(signals, angles=DEFAULT_MODEL_ANGLES):
    f = {}
    for a in angles:
        f.update(summary(signals[a], a))
    return f


def make_sequence(signals, angles=DEFAULT_MODEL_ANGLES):
    """(60, n_angles) array scaled to 0-1, same as Colab make_sequences()."""
    return (np.stack([signals[a] for a in angles], axis=-1) / 180.0).astype("float32")
