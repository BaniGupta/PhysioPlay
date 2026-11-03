# Put your trained models here

The backend loads every `*_meta.json` file in this folder when it starts.
Until a model is here, reps are scored with simple rules (still works fine for a demo).

For each exercise you need **2 files**:

| File | What it is |
|---|---|
| `elbow_flexion_xgb.joblib` (or `.keras` for GRU) | the trained model |
| `elbow_flexion_meta.json` | tells the backend how to use it |

Example `elbow_flexion_meta.json`:

```json
{
  "exercise": "elbow_flexion",
  "model_type": "xgboost",
  "model_file": "elbow_flexion_xgb.joblib",
  "trained_on": "IRDS_clf_bn_EFL + IRDS_clf_bn_EFR",
  "features": ["elbow_min", "elbow_max", "...same column order as in Colab..."],
  "frames": 60,
  "angles": ["elbow", "shoulder", "trunk"],
  "positive_class": "galat"
}
```

- `exercise` must be one of: `elbow_flexion`, `shoulder_abduction`, `shoulder_flexion`
- `model_type`: `xgboost`, `randomforest` or `gru`
- The model must output the probability of **galat** (incorrect) as class 1.

`colab_export.py` (in this folder) has the Colab code that creates both files.

After copying files here, restart the backend (or open http://localhost:8000/docs and call `POST /models/reload`).
