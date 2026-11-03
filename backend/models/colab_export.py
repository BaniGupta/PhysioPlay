# ============================================================
# Paste this into a NEW cell in your Colab notebook, AFTER the
# big "general code" cell has run (it uses its functions:
# load_fold, pick_moving_arm, make_features, make_sequences, build_gru).
#
# It trains the final model on ALL the data (testing is already done)
# and downloads the 2 files to copy into backend/models/.
# ============================================================
import json
import joblib
import numpy as np
from google.colab import files

EXERCISE = "elbow_flexion"                               # or shoulder_abduction / shoulder_flexion
DATASETS = ["IRDS_clf_bn_EFL", "IRDS_clf_bn_EFR"]       # left + right together = more data
MODEL_TYPE = "xgboost"                                   # or "gru"

F_all, S_all, y_all = [], [], []
for name in DATASETS:
    Xtr, ytr, Xte, yte = load_fold(name, 0)
    X = np.concatenate([Xtr, Xte])
    y = (np.concatenate([ytr, yte]) == 2).astype(int)    # 1 = galat
    arm = pick_moving_arm(Xtr)
    F_all.append(make_features(X, arm))
    S_all.append(make_sequences(X, arm))
    y_all.append(y)

import pandas as pd
F = pd.concat(F_all, ignore_index=True)
S = np.concatenate(S_all)
y = np.concatenate(y_all)
print("Training on", len(y), "recordings,", int(y.sum()), "galat")

if MODEL_TYPE == "xgboost":
    from xgboost import XGBClassifier
    model = XGBClassifier(n_estimators=300, max_depth=3, learning_rate=0.05, subsample=0.8,
                          colsample_bytree=0.8, random_state=42, eval_metric="logloss",
                          scale_pos_weight=(y == 0).sum() / max((y == 1).sum(), 1))
    model.fit(F, y)
    model_file = f"{EXERCISE}_xgb.joblib"
    joblib.dump(model, model_file)
else:
    from tensorflow import keras
    keras.utils.set_random_seed(0)
    model = build_gru(S.shape[1], S.shape[2])
    cw = {0: len(y) / (2 * (y == 0).sum()), 1: len(y) / (2 * (y == 1).sum())}
    model.fit(S, y, epochs=150, batch_size=16, class_weight=cw, verbose=0)
    model_file = f"{EXERCISE}_gru.keras"
    model.save(model_file)

meta = {
    "exercise": EXERCISE,
    "model_type": MODEL_TYPE,
    "model_file": model_file,
    "trained_on": " + ".join(DATASETS),
    "features": list(F.columns),
    "frames": 60,
    "angles": ["elbow", "shoulder", "trunk"],
    "positive_class": "galat",
}
with open(f"{EXERCISE}_meta.json", "w") as fh:
    json.dump(meta, fh, indent=2)

files.download(model_file)
files.download(f"{EXERCISE}_meta.json")
print("Done. Copy both files into backend/models/")
