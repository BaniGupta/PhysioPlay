// Things all games share: size, colours, fonts, score pop-ups, sparkle textures.
// Text comes from bridge.t (the current language), so games work in English, Hindi and Punjabi.
export const W = 960;
export const H = 600;

export const C = {
  ink: 0x1f2350,
  marigold: 0xf4a40c,
  rani: 0xd4246e,
  sarson: 0x2f7d4f,
  cream: 0xfff4de,
  white: 0xffffff,
};

// Baloo 2 covers English + Hindi, Baloo Paaji 2 covers Punjabi (Gurmukhi).
export const FONT = '"Baloo 2", "Baloo Paaji 2", "Hind", sans-serif';

export function verdict(score, t) {
  if (score >= 85) return { word: t("verdict.great"), color: "#F4A40C" };
  if (score >= 65) return { word: t("verdict.good"), color: "#FFFFFF" };
  return { word: t("verdict.keep"), color: "#FF8DB8" };
}

/** Makes small diamond textures used for particles. */
export function makeSparkTextures(scene) {
  [["spark-gold", C.marigold], ["spark-pink", C.rani], ["spark-green", C.sarson], ["spark-white", C.cream], ["drop", 0x58a6e8]]
    .forEach(([key, color]) => {
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(color, 1);
      if (key === "drop") g.fillCircle(6, 6, 6);
      else g.fillPoints([{ x: 7, y: 0 }, { x: 14, y: 7 }, { x: 7, y: 14 }, { x: 0, y: 7 }], true);
      g.generateTexture(key, 14, 14);
      g.destroy();
    });
}

/** Floating "+86 Great!" text. */
export function scorePop(scene, x, y, score, t) {
  const v = verdict(score, t);
  const txt = scene.add.text(x, y, `+${Math.round(score)}\n${v.word}`, {
    fontFamily: FONT, fontSize: "34px", fontStyle: "800", color: v.color, align: "center",
    stroke: "#1F2350", strokeThickness: 7,
  }).setOrigin(0.5).setDepth(50).setScale(0.4);
  scene.tweens.add({ targets: txt, scale: 1, duration: 260, ease: "Back.Out" });
  scene.tweens.add({ targets: txt, y: y - 90, alpha: 0, delay: 650, duration: 700, onComplete: () => txt.destroy() });
}

/** Big centred banner, e.g. "Set 1 done". */
export function banner(scene, text, sub) {
  const box = scene.add.container(W / 2, H / 2).setDepth(60).setScale(0.6).setAlpha(0);
  const bg = scene.add.graphics();
  bg.fillStyle(C.ink, 0.92);
  bg.fillRoundedRect(-250, -75, 500, 150, 26);
  bg.lineStyle(4, C.marigold, 1);
  bg.strokeRoundedRect(-250, -75, 500, 150, 26);
  const t1 = scene.add.text(0, sub ? -20 : 0, text, { fontFamily: FONT, fontSize: "44px", fontStyle: "800", color: "#ffffff" }).setOrigin(0.5);
  box.add([bg, t1]);
  if (sub) box.add(scene.add.text(0, 34, sub, { fontFamily: FONT, fontSize: "22px", color: "#F4A40C" }).setOrigin(0.5));
  scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 300, ease: "Back.Out" });
  scene.tweens.add({ targets: box, alpha: 0, delay: 1700, duration: 400, onComplete: () => box.destroy() });
}

/** Draws a vertical gradient into a canvas texture. */
export function gradientTexture(scene, key, w, h, stops) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach(([p, c]) => grd.addColorStop(p, c));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  tex.refresh();
}

/** Coaching line at the bottom of every game: the named mistake, or what to do next. */
export function makeCoach(scene) {
  const box = scene.add.text(W / 2, H - 22, "", {
    fontFamily: FONT, fontSize: "24px", fontStyle: "700", color: "#ffffff",
    backgroundColor: "#1F2350", padding: { x: 16, y: 6 }, align: "center",
  }).setOrigin(0.5, 1).setDepth(70).setVisible(false);
  let last = "", lastWarn = null;
  return {
    update() {
      const c = scene.bridge.controls;
      const text = c.cue || "";
      if (text !== last) { box.setText(text); box.setVisible(!!text); last = text; }
      if (c.cueWarn !== lastWarn) { box.setBackgroundColor(c.cueWarn ? "#C21F63" : "#1F2350"); lastWarn = c.cueWarn; }
    },
  };
}

/** A small floating word, e.g. "Great reach!". */
export function floatText(scene, x, y, text, color = "#FFFFFF") {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT, fontSize: "26px", fontStyle: "800", color, stroke: "#1F2350", strokeThickness: 6,
  }).setOrigin(0.5).setDepth(55);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, onComplete: () => t.destroy() });
}
