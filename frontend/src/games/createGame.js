// Starts a Phaser game inside a <div>. A game only reads `bridge`:
//   bridge.controls = { level: 0..1, formOk: boolean }   <- updated every frame by the engine
//   bridge.events   = [{ type: "rep", score, flags }, { type: "set", set, last }]
//   bridge.config   = { repsPerSet, sets, targetLevel }
//   bridge.t        = translate function for the current language
// Because games never look at the body directly, every game works with every exercise
// (arm, shoulder, knee, back...). A new game = a new Phaser scene that reads the same bridge.

import { W, H } from "./shared";

const LOADERS = {
  bird_flight: () => import("./BirdFlight").then((m) => m.makeBirdFlight),
  hand_pump: () => import("./HandPump").then((m) => m.makeHandPump),
  balloon_pop: () => import("./BalloonPop").then((m) => m.makeBalloonPop),
};

export async function createGame(parent, gameKey, bridge) {
  const Phaser = (await import("phaser")).default;
  const make = await (LOADERS[gameKey] || LOADERS.bird_flight)();
  const scene = make(Phaser);

  await Promise.all([
    document.fonts?.load?.('800 30px "Baloo 2"'),
    document.fonts?.load?.('800 30px "Baloo Paaji 2"'),
  ].map((p) => Promise.resolve(p).catch(() => {})));

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    backgroundColor: "#1F2350",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },          // our own Web Audio sounds are used instead
    banner: false,
    callbacks: { preBoot: (game) => game.registry.set("bridge", bridge) },
    scene: [scene],
  });
}
