// BIRD FLIGHT — works with any exercise.
// How far you move is the bird's height. Fly through the embroidered hoops.
// No game over: a missed hoop just gives no points. Bad form slows the world down.

import { W, H, C, FONT, makeSparkTextures, scorePop, banner, gradientTexture, makeCoach, floatText } from "./shared";
import { sfx } from "./sounds";

const BIRD_X = 270;
const levelToY = (l) => H - 95 - l * (H - 210);

export function makeBirdFlight(Phaser) {
  return class BirdFlight extends Phaser.Scene {
    constructor() { super("BirdFlight"); }

    create() {
      this.bridge = this.registry.get("bridge");
      makeSparkTextures(this);
      this._textures();

      this.add.image(0, 0, "bf-sky").setOrigin(0);
      this.add.circle(720, 430, 120, 0xffd27a, 0.2);
      this.sun = this.add.circle(720, 430, 74, 0xffd27a);
      this.clouds = [0, 1, 2, 3].map((i) =>
        this.add.image(120 + i * 260, 70 + (i % 2) * 60, "bf-cloud").setAlpha(0.85).setScale(0.7 + (i % 3) * 0.2));
      this.hillsFar = this.add.tileSprite(0, H - 230, W, 230, "bf-hills-far").setOrigin(0);
      this.hillsNear = this.add.tileSprite(0, H - 150, W, 150, "bf-hills-near").setOrigin(0);

      // goal line: the patient's own goal (from their calibrated range and target)
      const ty = levelToY(this.bridge.config.targetLevel);
      const dash = this.add.graphics().setDepth(2);
      dash.lineStyle(3, C.rani, 0.7);
      for (let x = 0; x < W; x += 22) dash.lineBetween(x, ty, x + 11, ty);
      this.add.text(16, ty - 30, this.bridge.t("game.target"), { fontFamily: FONT, fontSize: "18px", color: "#ffffff", stroke: "#D4246E", strokeThickness: 5 })
        .setOrigin(0, 0).setDepth(2);

      this.hoops = this.add.group();
      this.bird = this.add.container(BIRD_X, levelToY(0)).setDepth(10);
      this.wing = this.add.image(-4, -4, "bf-wing").setOrigin(0.85, 0.85);
      this.bird.add([this.add.image(0, 0, "bf-body"), this.wing]);
      this.tweens.add({ targets: this.wing, angle: { from: -28, to: 22 }, duration: 210, yoyo: true, repeat: -1 });

      this.sparkGold = this.add.particles(0, 0, "spark-gold", {
        speed: { min: 120, max: 320 }, lifespan: 700, scale: { start: 1.3, end: 0 }, rotate: { min: 0, max: 360 }, emitting: false,
      }).setDepth(20);
      this.sparkPink = this.add.particles(0, 0, "spark-pink", {
        speed: { min: 80, max: 240 }, lifespan: 600, scale: { start: 1, end: 0 }, emitting: false,
      }).setDepth(20);

      this.hoopCount = 0;
      this.hoopText = this.add.text(24, 20, "", { fontFamily: FONT, fontSize: "28px", fontStyle: "800", color: "#ffffff", stroke: "#1F2350", strokeThickness: 6 }).setDepth(30);
      this._updateHoopText();

      this.coach = makeCoach(this);
      this.score = 0;
      this.scoreText = this.add.text(W - 24, 20, "", { fontFamily: FONT, fontSize: "28px", fontStyle: "800", color: "#ffffff", stroke: "#1F2350", strokeThickness: 6 }).setOrigin(1, 0).setDepth(30);
      this._updateScore();
      this.speed = 1;
      this.birdY = levelToY(0);
      this.lastBuzz = 0;
      this.time.addEvent({ delay: 2300, loop: true, callback: () => this._spawnHoop() });
      this._spawnHoop();
    }

    _updateHoopText() { this.hoopText.setText(this.bridge.t("game.hoops", { n: this.hoopCount })); }

    _updateScore() { this.scoreText.setText(this.bridge.t("game.points", { n: Math.round(this.score) })); }

    _addPoints(n) { this.score += n; this._updateScore(); }

    _textures() {
      gradientTexture(this, "bf-sky", W, H, [[0, "#2B2F6E"], [0.45, "#7D5BA6"], [0.78, "#F2A65A"], [1, "#FFD9A0"]]);
      const g = this.make.graphics({ add: false });
      // hills
      const hills = (key, h, color, amp, freq, flowers) => {
        if (this.textures.exists(key)) return;
        g.clear();
        g.fillStyle(color, 1);
        const pts = [{ x: 0, y: h }];
        for (let x = 0; x <= W; x += 8) pts.push({ x, y: h * 0.35 + Math.sin((x / W) * Math.PI * 2 * freq) * amp });
        pts.push({ x: W, y: h });
        g.fillPoints(pts, true);
        if (flowers) {
          for (let i = 0; i < 160; i++) {
            const x = (i * 97) % W, y = h * 0.55 + ((i * 53) % (h * 0.4));
            g.fillStyle(i % 5 ? 0xf6d33c : 0xffffff, 1);
            g.fillCircle(x, y, 2.4);
          }
        }
        g.generateTexture(key, W, h);
      };
      hills("bf-hills-far", 230, 0x4f6d8f, 26, 2, false);
      hills("bf-hills-near", 150, 0x3f8a4a, 14, 3, true);

      if (!this.textures.exists("bf-cloud")) {
        g.clear(); g.fillStyle(0xffffff, 1);
        g.fillEllipse(70, 45, 120, 44); g.fillEllipse(110, 32, 80, 50); g.fillEllipse(40, 34, 60, 36);
        g.generateTexture("bf-cloud", 160, 80);
      }
      if (!this.textures.exists("bf-body")) {
        g.clear();
        g.fillStyle(C.marigold, 1); g.fillEllipse(40, 30, 72, 50);           // body
        g.fillStyle(0xffd88a, 1); g.fillEllipse(46, 38, 40, 22);             // belly
        g.fillStyle(C.rani, 1); g.fillTriangle(4, 22, 14, 30, 2, 40);         // tail
        g.fillStyle(0xff7a1a, 1); g.fillTriangle(74, 26, 92, 32, 74, 37);     // beak
        g.fillStyle(0xffffff, 1); g.fillCircle(62, 22, 8);
        g.fillStyle(C.ink, 1); g.fillCircle(64, 22, 4.5);
        g.generateTexture("bf-body", 96, 60);
      }
      if (!this.textures.exists("bf-wing")) {
        g.clear(); g.fillStyle(C.rani, 1);
        g.fillPoints([{ x: 0, y: 4 }, { x: 46, y: 0 }, { x: 52, y: 26 }, { x: 18, y: 30 }], true);
        g.lineStyle(2, 0xffffff, 0.5);
        for (let i = 1; i < 4; i++) g.lineBetween(10 + i * 9, 4, 14 + i * 9, 26);
        g.generateTexture("bf-wing", 54, 32);
      }
      if (!this.textures.exists("bf-hoop")) {
        g.clear();
        const R = 54;
        g.lineStyle(10, C.rani, 1); g.strokeCircle(64, 64, R);
        g.lineStyle(4, C.marigold, 1);
        for (let a = 0; a < 360; a += 20) {      // darn stitches around the hoop
          const r1 = (a * Math.PI) / 180, r2 = ((a + 10) * Math.PI) / 180;
          g.beginPath(); g.arc(64, 64, R, r1, r2); g.strokePath();
        }
        g.fillStyle(C.marigold, 1);
        g.fillPoints([{ x: 64, y: 0 }, { x: 74, y: 10 }, { x: 64, y: 20 }, { x: 54, y: 10 }], true);
        g.generateTexture("bf-hoop", 128, 128);
      }
      g.destroy();
    }

    _spawnHoop() {
      const t = this.bridge.config.targetLevel;
      const choices = [0.5 * t, 0.7 * t, 0.85 * t, t, t];   // never above the patient's own goal
      const level = Phaser.Utils.Array.GetRandom(choices);
      const hoop = this.add.image(W + 80, levelToY(level), "bf-hoop").setDepth(5);
      hoop.setData("done", false);
      this.hoops.add(hoop);
    }

    _events() {
      const ev = this.bridge.events;
      while (ev.length) {
        const e = ev.shift();
        if (e.type === "reach") {
          // instant reward the moment the goal is reached (no need to wait until the arm is back down)
          this._addPoints(10);
          sfx.ding();
          this.sparkGold.explode(18, BIRD_X, this.birdY);
          floatText(this, BIRD_X + 60, this.birdY - 50, this.bridge.t("game.reach"), "#F4A40C");
        } else if (e.type === "rep") {
          this._addPoints(e.score / 10);
          scorePop(this, BIRD_X + 40, this.birdY - 70, e.score, this.bridge.t);
          this.sparkPink.explode(14, BIRD_X, this.birdY);
        } else if (e.type === "set") {
          sfx.fanfare();
          banner(this, this.bridge.t("game.setdone", { n: e.set }), this.bridge.t(e.last ? "game.lastset" : "game.rest"));
        }
      }
    }

    update(_, dtMs) {
      const dt = dtMs / 1000;
      const { level, formOk } = this.bridge.controls;
      this._events();

      // bad form slows the world and greys the bird
      const want = formOk ? 1 : 0.35;
      this.speed += (want - this.speed) * Math.min(1, dt * 4);
      if (!formOk && this.time.now - this.lastBuzz > 1800) { sfx.buzz(); this.lastBuzz = this.time.now; }
      this.bird.iterate((c) => c.setTint && (formOk ? c.clearTint() : c.setTint(0x9fa2c4)));

      // bird follows your arm
      const targetY = levelToY(level);
      this.birdY += (targetY - this.birdY) * Math.min(1, dt * 10);
      this.bird.y = this.birdY;
      this.bird.angle = Phaser.Math.Clamp((targetY - this.birdY) * -0.25, -25, 25);

      this.coach.update();
      this.hillsFar.tilePositionX += 18 * dt * this.speed;
      this.hillsNear.tilePositionX += 60 * dt * this.speed;
      this.clouds.forEach((c, i) => { c.x -= (8 + i * 3) * dt * this.speed; if (c.x < -100) c.x = W + 100; });

      this.hoops.getChildren().slice().forEach((h) => {
        h.x -= 190 * dt * this.speed;
        if (!h.getData("done") && h.x <= BIRD_X) {
          h.setData("done", true);
          if (Math.abs(h.y - this.birdY) < 52) {
            this.hoopCount += 1;
            this._updateHoopText();
            this._addPoints(5);
            sfx.pop();
            this.sparkGold.explode(22, h.x, h.y);
            this.tweens.add({ targets: h, scale: 1.5, alpha: 0, duration: 300, onComplete: () => h.destroy() });
          } else {
            this.tweens.add({ targets: h, alpha: 0.25, duration: 300 });
          }
        }
        if (h.x < -90) h.destroy();
      });
    }
  };
}
