# PhysioPlay — physio exercises as games

Patients do their physiotherapy exercises in front of a webcam. MediaPipe tracks the body, the joint angle moves a mini-game, and an ML model (or form rules) scores every rep. Patients see their own progress, streaks and badges.

- **Languages:** English, हिन्दी, ਪੰਜਾਬੀ (switch at the top right, saved per account)
- **Recovery plans:** one account can have many plans (arm now, knee later). Start a new one with "+ New recovery plan", finish old ones with "Finish this plan".
- **Body areas and exercises (7):** shoulder (raise to side, raise to front), elbow & arm (elbow bend), knee/hip/leg (mini squat, sit to stand, seated knee straightening), back (side bend)
- **Games (3):** Bird Flight, Hand Pump, Balloon Pop. Every game works with every exercise; the patient picks one before playing.
- **Patients describe their problem in their own words** (up to 1000 characters, any language).
- **Camera checks before counting:** stand side-on or facing the camera (as the exercise needs), the plan's side towards the camera, and the right arm. Reps are not counted until this is right, and the screen says what to fix.
- **Named mistakes:** body leaning, elbow bent, upper arm moving, chest dropping, too fast, not reaching the goal. Shown live, after every rep, and as tips on the result screen.

## Run it (Mac)

Backend (first time):
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (first time), in a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 in Chrome.

Next times: only `source venv/bin/activate && uvicorn app.main:app --reload --port 8000` in backend and `npm run dev` in frontend.

The first start creates `backend/physioplay.db` with demo data. Delete that file to start fresh. Fonts are bundled, so the app works offline (the pose model file, about 9 MB, is downloaded by the browser once).

## Demo accounts

| Name | PIN | What you see |
|---|---|---|
| Riya Sharma | 1111 | Elbow plan, 24-day streak |
| Aman Gill | 2222 | Left shoulder plan |
| Harjeet Singh | 3333 | Finished arm plan + active left knee plan |

The first time you play an exercise, the app measures YOUR comfortable range (calibration). Balloons, hoops and the goal line are placed inside that range.

No camera? Choose "Demo mode" on the play screen (hold Space or use Auto-play).

## ML models

Put the exported files (`*_gru.keras` + `*_meta.json`) in `backend/models/`. The GRU models cover elbow flexion, shoulder abduction and shoulder flexion. Leg and back exercises are scored by form rules until a model for them is added. Check loaded models at http://localhost:8000/models.

## Tests

```bash
cd frontend && npm test
```
Checks the angle maths, side/front detection, wrong side / wrong arm warnings, named mistakes and rep counting with made-up skeletons.

## Project layout

```
backend/app/main.py      API (auth, recovery plans, sessions, progress)
backend/app/db.py        SQLite tables
backend/app/seed.py      exercises + demo data
backend/app/ml/          features + scorer (ML or rules)
backend/app/gamify.py    XP, levels, streaks, badges
frontend/src/i18n/       en.js, hi.js, pa.js
frontend/src/screens/    Login, PlanSetup, Home, Play, Progress
frontend/src/games/      BirdFlight, HandPump, BalloonPop (Phaser)
frontend/src/pose/       MediaPipe tracking + joint angles
frontend/src/engine/     rep counting, posture + form checks
frontend/tests/          logic tests (npm test)
```
