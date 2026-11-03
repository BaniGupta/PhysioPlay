// HAND PUMP — works with any exercise.
// How far you move drives the pump handle. Each good rep pours water into the bucket.
// A full bucket (one set) waters a pot and a marigold blooms.
// Rushing a rep splashes water out, so slow and steady fills faster.

import { W, H, C, FONT, makeSparkTextures, scorePop, banner, gradientTexture, makeCoach, floatText } from "./shared";
import { sfx } from "./sounds";

const PIVOT = { x: 360, y: 236 };
const SPOUT = { x: 466, y: 318 };
const BUCKET = { x: 470, y: 470, top: 120, bottom: 88, h: 96 };
const POTS = [650, 760, 870];

export function makeHandPump(Phaser) {
  return class HandPump extends Phaser.Scene {
    constructor() { super("HandPump"); }

    create() {
      this.bridge = this.registry.get("bridge");
      makeSparkTextures(this);
      this._textures();
      const cfg = this.bridge.config;

      // courtyard
      this.add.image(0, 0, "hp-sky").setOrigin(0);
      this.add.image(0, 150, "hp-wall").setOrigin(0);
      this.add.rectangle(0, 520, W, 80, 0xb9a07a).setOrigin(0);
      this.add.rectangle(0, 520, W, 6, 0x9c845f).setOrigin(0);

      // stone platform + pump body
      const g = this.add.graphics();
      g.fillStyle(0x8f949c, 1); g.fillRoundedRect(250, 500, 300, 34, 10);
      g.fillStyle(0xa9aeb6, 1); g.fillRoundedRect(262, 492, 276, 16, 8);
      g.fillStyle(0x2f5d50, 1);
      g.fillRoundedRect(330, 230, 60, 270, 14);           // body
      g.fillRoundedRect(318, 214, 84, 30, 10);            // cap
      g.fillRect(380, 300, 90, 26);                       // spout
      g.fillStyle(0x23493f, 1); g.fillRect(460, 300, 14, 40);
      g.fillStyle(0x3c7464, 1); g.fillRect(338, 250, 10, 230);   // shine
      g.fillStyle(C.marigold, 1); g.fillCircle(PIVOT.x, PIVOT.y, 9);

      // handle: rotates around the pivot (your elbow)
      this.handle = this.add.image(PIVOT.x, PIVOT.y, "hp-handle").setOrigin(1, 0.5).setDepth(5);
      this.add.circle(PIVOT.x, PIVOT.y, 7, C.cream).setDepth(6);

      // bucket
      this.bucketG = this.add.graphics().setDepth(4);
      this.fill = 0;            // 0..1 for the current set
      this.shownFill = 0;

      // water stream
      this.stream = this.add.rectangle(SPOUT.x + 1, SPOUT.y + 20, 14, BUCKET.y - SPOUT.y - 20, 0x58a6e8)
        .setOrigin(0.5, 0).setAlpha(0).setDepth(3);
      this.drops = this.add.particles(0, 0, "drop", {
        x: SPOUT.x, y: SPOUT.y + 26, speedY: { min: 220, max: 340 }, speedX: { min: -30, max: 30 },
        lifespan: 520, scale: { start: 0.9, end: 0.4 }, frequency: -1, gravityY: 500,
      }).setDepth(3);
      this.splash = this.add.particles(0, 0, "drop", {
        speed: { min: 140, max: 320 }, angle: { min: 200, max: 340 }, gravityY: 700,
        lifespan: 800, scale: { start: 1, end: 0.3 }, emitting: false,
      }).setDepth(7);
      this.sparkGold = this.add.particles(0, 0, "spark-gold", {
        speed: { min: 100, max: 260 }, lifespan: 800, scale: { start: 1.2, end: 0 }, emitting: false,
      }).setDepth(20);

      // pots: one per set
      this.pots = POTS.slice(0, Math.min(3, cfg.sets)).map((x) => this._makePot(x));
      this.setsDone = 0;

      this.fillText = this.add.text(24, 20, "", { fontFamily: FONT, fontSize: "28px", fontStyle: "800", color: "#1F2350", stroke: "#ffffff", strokeThickness: 6 }).setDepth(30);
      this.lastBuzz = 0;
      this.handleLevel = 0;
      this.coach = makeCoach(this);
      this._drawBucket();
    }

    _textures() {
      gradientTexture(this, "hp-sky", W, 160, [[0, "#9FD3F5"], [1, "#DDF0FB"]]);
      const g = this.make.graphics({ add: false });
      if (!this.textures.exists("hp-wall")) {
        g.clear();
        g.fillStyle(0xe8bd62, 1); g.fillRect(0, 0, W, 370);
        g.fillStyle(0xdcae52, 1);
        for (let y = 40; y < 370; y += 46) for (let x = (y / 46) % 2 ? 0 : 40; x < W; x += 80) g.fillRect(x, y, 70, 2);
        // painted diamond border along the top of the wall
        const cols = [C.rani, C.marigold, C.sarson, C.marigold];
        g.fillStyle(C.ink, 1); g.fillRect(0, 0, W, 34);
        for (let i = 0; i < W / 26 + 1; i++) {
          g.fillStyle(cols[i % 4], 1);
          const cx = 13 + i * 26;
          g.fillPoints([{ x: cx, y: 5 }, { x: cx + 12, y: 17 }, { x: cx, y: 29 }, { x: cx - 12, y: 17 }], true);
        }
        g.generateTexture("hp-wall", W, 370);
      }
      if (!this.textures.exists("hp-handle")) {
        g.clear();
        g.fillStyle(0x23493f, 1); g.fillRoundedRect(0, 4, 190, 16, 8);
        g.fillStyle(C.marigold, 1); g.fillRoundedRect(0, 0, 46, 24, 12);   // grip
        g.generateTexture("hp-handle", 190, 24);
      }
      g.destroy();
    }

    _makePot(x) {
      const c = this.add.container(x, 510).setDepth(4);
      const pot = this.add.graphics();
      pot.fillStyle(C.ink, 1);
      pot.fillPoints([{ x: -38, y: -56 }, { x: 38, y: -56 }, { x: 28, y: 0 }, { x: -28, y: 0 }], true);
      pot.fillStyle(C.marigold, 1);
      for (let i = -2; i <= 2; i++) pot.fillPoints([{ x: i * 13, y: -40 }, { x: i * 13 + 5, y: -34 }, { x: i * 13, y: -28 }, { x: i * 13 - 5, y: -34 }], true);
      pot.fillStyle(0x6b4f35, 1); pot.fillRect(-36, -60, 72, 8);
      const sprout = this.add.graphics();
      sprout.fillStyle(C.sarson, 1); sprout.fillRect(-2, -78, 4, 20); sprout.fillEllipse(-8, -74, 14, 8);
      c.add([pot, sprout]);
      return c;
    }

    _bloom(pot) {
      const stem = this.add.graphics();
      stem.fillStyle(C.sarson, 1);
      stem.fillRect(-3, -150, 6, 92);
      stem.fillEllipse(-16, -100, 26, 12); stem.fillEllipse(16, -120, 26, 12);
      stem.scaleY = 0;
      pot.add(stem);
      const flower = this.add.container(0, -156).setScale(0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        flower.add(this.add.ellipse(Math.cos(a) * 16, Math.sin(a) * 16, 24, 15, i % 2 ? 0xf4a40c : 0xff8a1a).setRotation(a));
      }
      flower.add(this.add.circle(0, 0, 10, 0xc65a00));
      pot.add(flower);
      this.tweens.add({ targets: stem, scaleY: 1, duration: 600, ease: "Cubic.Out" });
      this.tweens.add({ targets: flower, scale: 1, delay: 450, duration: 650, ease: "Back.Out" });
      this.tweens.add({ targets: flower, angle: 360, delay: 1100, duration: 6000, repeat: -1 });
      this.sparkGold.explode(26, pot.x, pot.y - 150);
    }

    _drawBucket() {
      const g = this.bucketG;
      const { x, y, top, bottom, h } = BUCKET;
      g.clear();
      const f = Math.max(0, Math.min(1, this.shownFill));
      // water
      if (f > 0) {
        const wh = h * f;
        const wTop = bottom + (top - bottom) * f;
        g.fillStyle(0x58a6e8, 1);
        g.fillPoints([{ x: x - wTop / 2 + 4, y: y + h - wh }, { x: x + wTop / 2 - 4, y: y + h - wh },
          { x: x + bottom / 2 - 4, y: y + h - 4 }, { x: x - bottom / 2 + 4, y: y + h - 4 }], true);
        g.fillStyle(0xa9d6fb, 1);
        g.fillRect(x - wTop / 2 + 6, y + h - wh, wTop - 12, 4);
      }
      // bucket outline
      g.lineStyle(7, 0x7d8794, 1);
      g.strokePoints([{ x: x - top / 2, y }, { x: x - bottom / 2, y: y + h }, { x: x + bottom / 2, y: y + h }, { x: x + top / 2, y }], false);
      g.lineStyle(4, 0x5c6470, 1);
      g.beginPath(); g.arc(x, y + 4, top / 2, Math.PI, 0); g.strokePath();
      g.fillStyle(C.rani, 1); g.fillRect(x - top / 2 + 2, y + 22, top - 4, 6);
    }

    _pour(amount, splash) {
      sfx.pour();
      this.stream.setAlpha(0.85);
      this.drops.start();
      this.tweens.add({ targets: this.stream, alpha: 0, delay: 650, duration: 250 });
      this.time.delayedCall(800, () => this.drops.stop());
      if (splash) {
        sfx.splash();
        this.splash.explode(28, BUCKET.x, BUCKET.y + 10);
      }
      this.fill = Math.min(1, this.fill + amount);
    }

    _events() {
      const ev = this.bridge.events;
      const per = 1 / this.bridge.config.repsPerSet;
      while (ev.length) {
        const e = ev.shift();
        if (e.type === "reach") {
          sfx.tick();
          floatText(this, PIVOT.x - 120, PIVOT.y - 60, this.bridge.t("game.reach"), "#F4A40C");
        } else if (e.type === "rep") {
          const rushed = e.flags?.includes("too_fast");
          this._pour(rushed ? per * 0.5 : per, rushed);
          scorePop(this, SPOUT.x + 70, SPOUT.y - 30, e.score, this.bridge.t);
          if (e.score >= 65) sfx.ding();
        } else if (e.type === "set") {
          sfx.fanfare();
          const pot = this.pots[Math.min(this.setsDone, this.pots.length - 1)];
          this.setsDone += 1;
          this.time.delayedCall(500, () => { this._bloom(pot); this.fill = 0; });
          banner(this, this.bridge.t("game.setdone", { n: e.set }), this.bridge.t(e.last ? "game.bloom" : "game.flower"));
        }
      }
    }

    update(_, dtMs) {
      const dt = dtMs / 1000;
      const { level, formOk } = this.bridge.controls;
      this._events();

      // the handle's full swing = the patient's own goal
      const goal = this.bridge.config.targetLevel || 1;
      this.handleLevel += (Math.min(1.1, level / goal) - this.handleLevel) * Math.min(1, dt * 12);
      this.handle.rotation = 0.38 - this.handleLevel * 0.8;
      if (formOk) this.handle.clearTint(); else this.handle.setTint(0xff6f9f);
      if (!formOk && this.time.now - this.lastBuzz > 1800) { sfx.buzz(); this.lastBuzz = this.time.now; }

      if (Math.abs(this.shownFill - this.fill) > 0.002) {
        this.shownFill += (this.fill - this.shownFill) * Math.min(1, dt * 3);
        this._drawBucket();
      }
      this.fillText.setText(this.bridge.t("game.bucket", { n: Math.round(this.fill * 100) }));
      this.coach.update();
    }
  };
}
