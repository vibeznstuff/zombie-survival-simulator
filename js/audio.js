/* =====================================================================
   audio.js — tiny WebAudio chiptune sound effects (no assets)
   ===================================================================== */

"use strict";

const Sfx = (() => {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One square/triangle blip
  function tone(freq, dur, type = "square", vol = 0.12, delay = 0, slide = 0) {
    if (muted) return;
    const a = ac();
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Short white-noise burst (hits, crunches)
  function noise(dur, vol = 0.14, delay = 0) {
    if (muted) return;
    const a = ac();
    const t0 = a.currentTime + delay;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(gain).connect(a.destination);
    src.start(t0);
  }

  return {
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    unlock() { try { ac(); } catch (e) { /* no audio available */ } },

    pickup()   { tone(660, 0.07); tone(990, 0.09, "square", 0.12, 0.06); },
    medkit()   { tone(523, 0.08); tone(659, 0.08, "square", 0.12, 0.07); tone(784, 0.12, "square", 0.12, 0.14); },
    eat()      { tone(300, 0.06, "triangle", 0.15); tone(240, 0.08, "triangle", 0.15, 0.07); },
    hit()      { noise(0.06, 0.12); tone(160, 0.06, "square", 0.10, 0, -60); },
    hurt()     { noise(0.09, 0.16); tone(110, 0.12, "sawtooth", 0.10, 0, -40); },
    zombieDie(){ tone(200, 0.18, "sawtooth", 0.12, 0, -150); noise(0.12, 0.10, 0.05); },
    levelUp()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, "square", 0.13, i * 0.07)); },
    recruit()  { tone(392, 0.09); tone(523, 0.09, "square", 0.12, 0.08); tone(659, 0.14, "square", 0.12, 0.16); },
    decline()  { tone(220, 0.10); tone(180, 0.14, "square", 0.10, 0.09); },
    infected() { [440, 415, 392, 370].forEach((f, i) => tone(f, 0.12, "triangle", 0.12, i * 0.10)); },
    cure()     { [370, 440, 554, 740].forEach((f, i) => tone(f, 0.10, "triangle", 0.13, i * 0.07)); },
    memberDie(){ [330, 262, 196, 131].forEach((f, i) => tone(f, 0.16, "triangle", 0.14, i * 0.14)); },
    steal()    { tone(500, 0.05, "square", 0.10, 0, -200); tone(350, 0.08, "square", 0.10, 0.06, -150); },
    gameOver() { [392, 370, 330, 262, 196, 131].forEach((f, i) => tone(f, 0.22, "triangle", 0.15, i * 0.18)); },
    start()    { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.10, "square", 0.12, i * 0.08)); },
  };
})();
