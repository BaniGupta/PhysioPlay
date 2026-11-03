// BALLOON POP — works with any exercise.
// How far you move raises the pin. Reach the balloon (or higher) and HOLD still for a moment to
// pop it (holding at the top is good therapy). Then go back to the start for the next balloon.
//
// The balloon always sits at the patient's OWN goal (from their calibrated range), never higher,
// so a patient with a small range gets low balloons they can actually reach. One balloon = one rep:
// the counter shows reps counted by the rep counter, so the game and the side panel always agree.
// Bad form: the pin turns pink and the hold timer pauses until the form is good again.

import { W, H, C, FONT, makeSparkTextures, scorePop, banner, gradientTexture, makeCoach, floatText } from "./shared";
import { sfx } from "./sounds";

const PIN_X = 300;
const BALLOON_X = PIN_X + 92;
const HOLD_SECONDS = 0.4;
const TOUCH_MARGIN = 0.06;   // how far below the balloon still counts as touching (in level units)
const COLORS = [C.rani, C.marigold, C.sarson, 0x3f86d6];
const levelToY = (l) => H - 105 - l * (H - 230);

export function makeBalloonPop(Phaser) {
  return class BalloonPop extends Phaser.Scene {
    constructor() { super("BalloonPop"); }

    create() {
      this.bridge = this.registry.get("bridge");
      const t = this.bridge.t;
      makeSparkTextures(this);
      this._textures();

      this.add.image(0, 0, "bp-sky").setOrigin(0);
      this._bunting();
      this.add.image(0, H - 90, "bp-ground").setOrigin(0);

      // target line
      const ty = levelToY(this.bridge.config.targetLevel);
      const dash = this.add.graphics().setDepth(2);
      dash.lineStyle(3, C.rani, 0.6);
      for (let x = 0; x < W; x += 22) dash.lineBetween(x, ty, x + 11, ty);
      this.add.text(W - 16, ty - 30, t("game.target"), { fontFamily: FONT, fontSize: "18px", color: "#ffffff", stroke: "#D4246E", strokeThickness: 5 })
        .setOrigin(1, 0).setDepth(2);

      // pin on its rail
      const rail = this.add.graphics().setDepth(3);
      rail.lineStyle(6, C.ink, 0.25);
      rail.lineBetween(PIN_X, levelToY(0) + 30, PIN_X, levelToY(1) - 30);
      this.pin = this.add.image(PIN_X, levelToY(0), "bp-pin").setDepth(10);

      // balloon + string + hold ring
      this.string = this.add.graphics().setDepth(4);
      this.balloon = this.add.image(BALLOON_X, 0, "bp-bal-0").setDepth(5);
      this.ring = this.add.graphics().setDepth(6);

      this.confetti = ["spark-gold", "spark-pink", "spark-green"].map((k) =>
        this.add.particles(0, 0, k, {
          speed: { min: 140, max: 380 }, lifespan: 900, gravityY: 300, rotate: { min: 0, max: 360 },
          scale: { start: 1.2, end: 0.2 }, emitting: false,
        }).setDepth(20));

      this.hint = this.add.text(PIN_X + 30, levelToY(0) + 34, t("game.goback"), {
        fontFamily: FONT, fontSize: "20px", color: "#1F2350", backgroundColor: "#ffffffcc", padding: { x: 10, y: 4 },
      }).setDepth(30).setAlpha(0);

      this.count = 0;            // reps counted (from the rep counter)
      this.countText = this.add.text(24, 64, "", { fontFamily: FONT, fontSize: "28px", fontStyle: "800", color: "#ffffff", stroke: "#1F2350", strokeThickness: 6 }).setDepth(30);
      this._updateCount();

      this.coach = makeCoach(this);
      this.pinY = levelToY(0);
      this.hold = 0;
      this.lastBuzz = 0;
      this.lastLevelChoice = -1;
      this._newBalloon(true);
    }

    _updateCount() {
      const total = this.bridge.config.repsPerSet * this.bridge.config.sets;
      this.countText.setText(this.bridge.t("game.reps", { n: this.count, total }));
    }

    _textures() {
      gradientTexture(this, "bp-sky", W, H, [[0, "#7FD3E8"], [0.6, "#CDEFF3"], [1, "#FFF4DE"]]);
      const g = this.make.graphics({ add: false });
      if (!this.textures.exists("bp-ground")) {
        g.clear();
        g.fillStyle(0x6fbf73, 1);
        const pts = [{ x: 0, y: 90 }];
        for (let x = 0; x <= W; x += 10) pts.push({ x, y: 22 + Math.sin(x / 90) * 8 });
        pts.push({ x: W, y: 90 });
        g.fillPoints(pts, true);
        g.fillStyle(0x4f9f57, 1);
        for (let i = 0; i < 70; i++) g.fillCircle((i * 137) % W, 45 + ((i * 31) % 40), 2.2);
        g.generateTexture("bp-ground", W, 90);
      }
      COLORS.forEach((col, i) => {
        const key = `bp-bal-${i}`;
        if (this.textures.exists(key)) return;
        g.clear();
        g.fillStyle(col, 1);
        g.fillEllipse(40, 44, 72, 86);
        g.fillTriangle(34, 88, 46, 88, 40, 80);
        g.fillStyle(0xffffff, 0.35);
        g.fillEllipse(26, 28, 16, 26);
        g.generateTexture(key, 80, 92);
      });
      if (!this.textures.exists("bp-pin")) {
        g.clear();
        g.fillStyle(0x9aa3b5, 1);
        g.fillTriangle(40, 16, 72, 20, 40, 24);                        // needle
        g.fillStyle(C.marigold, 1);
        g.fillPoints([{ x: 20, y: 0 }, { x: 40, y: 20 }, { x: 20, y: 40 }, { x: 0, y: 20 }], true);
        g.fillStyle(C.rani, 1);
        g.fillPoints([{ x: 20, y: 9 }, { x: 31, y: 20 }, { x: 20, y: 31 }, { x: 9, y: 20 }], true);
        g.generateTexture("bp-pin", 74, 40);
      }
      g.destroy();
    }

    _bunting() {
      const g = this.add.graphics().setDepth(1);
      const sag = (x) => 26 + Math.sin((x / W) * Math.PI) * 26;
      g.lineStyle(2, C.ink, 0.5);
      g.beginPath();
      g.moveTo(0, sag(0));
      for (let x = 0; x <= W; x += 20) g.lineTo(x, sag(x));
      g.strokePath();
      const flags = [C.rani, C.marigold, C.sarson, 0x3f86d6];
      for (let i = 0, x = 20; x < W; x += 48, i++) {
        const y = sag(x);
        g.fillStyle(flags[i % flags.length], 1);
        g.fillTriangle(x - 14, y, x + 14, y, x, y + 26);
      }
    }

    _newBalloon(first = false) {
      const goal = this.bridge.config.targetLevel;
      // always at (or just under) the patient's own goal, so it can be reached and popping = a full rep
      const options = [0.9 * goal, 0.95 * goal, goal];
      let idx;
      do { idx = Phaser.Math.Between(0, options.length - 1); } while (idx === this.lastLevelChoice && !first);
      this.lastLevelChoice = idx;
      this.balloonLevel = options[idx];
      this.balloonBaseY = levelToY(this.balloonLevel);
      this.balloon.setTexture(`bp-bal-${Phaser.Math.Between(0, COLORS.length - 1)}`);
      this.balloon.setScale(0.2).setAlpha(first ? 1 : 0.35);
      this.tweens.add({ targets: this.balloon, scale: 1, duration: 380, ease: "Back.Out" });
      this.armed = first;
      this.hold = 0;
    }

    _pop() {
      sfx.pop();
      const { x, y } = this.balloon;
      this.confetti.forEach((p) => p.explode(14, x, y));
      floatText(this, x, y - 70, this.bridge.t("game.popped"), "#F4A40C");
      this.balloon.setScale(0);
      this.time.delayedCall(250, () => this._newBalloon());
    }

    _events() {
      const ev = this.bridge.events;
      while (ev.length) {
        const e = ev.shift();
        if (e.type === "reach") {
          // the goal was reached: this rep counts now (it is scored when the patient comes back down)
          this.count += 1;
          this._updateCount();
        } else if (e.type === "rep") {
          if (e.flags?.includes("partial")) { this.count += 1; this._updateCount(); }   // partial reps never "reach"
          scorePop(this, BALLOON_X + 150, this.balloonBaseY - 40, e.score, this.bridge.t);
          if (e.score >= 65) sfx.ding();
        } else if (e.type === "set") {
          sfx.fanfare();
          banner(this, this.bridge.t("game.setdone", { n: e.set }), this.bridge.t(e.last ? "game.lastset" : "game.rest"));
        }
      }
    }

    update(time, dtMs) {
      const dt = dtMs / 1000;
      const { level, formOk } = this.bridge.controls;
      this._events();

      // pin follows the movement
      this.pinY += (levelToY(level) - this.pinY) * Math.min(1, dt * 14);
      this.pin.y = this.pinY;
      if (formOk) this.pin.clearTint(); else this.pin.setTint(0xff6f9f);
      if (!formOk && time - this.lastBuzz > 1800) { sfx.buzz(); this.lastBuzz = time; }

      // balloon bobs gently, string hangs below
      const by = this.balloonBaseY + Math.sin(time / 420) * 6;
      this.balloon.y = by;
      this.string.clear();
      this.string.lineStyle(2, C.ink, 0.45);
      this.string.beginPath();
      this.string.moveTo(BALLOON_X, by + 46);
      for (let i = 1; i <= 8; i++) this.string.lineTo(BALLOON_X + Math.sin(time / 300 + i) * 4, by + 46 + i * 9);
      this.string.strokePath();

      // a new balloon "arms" once you are back near the start position
      const goal = this.bridge.config.targetLevel;
      const restLine = Math.max(0.07, Math.min(0.22, goal * 0.25));
      if (!this.armed) {
        this.hint.setAlpha(level > restLine ? 1 : 0);
        this.hint.y = this.pinY + 30;
        if (level < restLine) {
          this.armed = true;
          this.tweens.add({ targets: this.balloon, alpha: 1, duration: 200 });
        }
      } else {
        this.hint.setAlpha(0);
        // touching = reached the balloon or went higher (uses the real level, not the animated pin)
        const touching = level >= Math.max(this.balloonLevel - TOUCH_MARGIN, goal * 0.86);   // 0.86 = just above the rep counter's "reached" line
        if (touching && formOk) this.hold += dt / HOLD_SECONDS;
        else if (!touching) this.hold = Math.max(0, this.hold - dt * 0.8);   // a small wobble doesn't reset it
        if (this.hold >= 1) { this.armed = false; this._pop(); }
      }
      this.coach.update();

      // hold ring around the balloon
      this.ring.clear();
      if (this.armed && this.hold > 0) {
        this.ring.lineStyle(6, C.marigold, 1);
        this.ring.beginPath();
        this.ring.arc(BALLOON_X, by, 54, -Math.PI / 2, -Math.PI / 2 + this.hold * Math.PI * 2);
        this.ring.strokePath();
      }
    }
  };
}
