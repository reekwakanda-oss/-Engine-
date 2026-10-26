#!/usr/bin/env node
// Generates the built-in animation library (assets/gifs/*.gif) from code-drawn pixel art.
// Usage: npm run generate-gifs

const fs = require('node:fs');
const path = require('node:path');
const { Sprite } = require('./lib/sprite');
const { encodeGif } = require('./lib/gif-encoder');

const SIZE = 40;
const SCALE = 3;
const TAU = Math.PI * 2;

// Index 0 is transparent. Shared by every sprite.
const PALETTE = [
  [255, 0, 255], // 0 transparent
  [27, 27, 47], // 1 outline / ink
  [255, 255, 255], // 2 white
  [0, 0, 0], // 3 (unused)
  [90, 209, 106], // 4 slime
  [58, 158, 79], // 5 slime shade
  [182, 245, 168], // 6 slime highlight
  [255, 143, 177], // 7 blush / pink
  [245, 161, 66], // 8 cat
  [201, 116, 34], // 9 cat stripes
  [255, 224, 184], // 10 cream
  [232, 236, 255], // 11 ghost
  [169, 180, 232], // 12 ghost shade
  [255, 77, 109], // 13 heart
  [201, 24, 74], // 14 heart shade
  [255, 179, 193], // 15 heart highlight
  [255, 209, 102], // 16 flame yellow
  [255, 159, 28], // 17 flame orange
  [232, 93, 4], // 18 flame red
  [255, 243, 176], // 19 flame core
  [139, 90, 43], // 20 wood
  [94, 58, 26], // 21 wood dark
  [255, 224, 102], // 22 star
  [244, 180, 0], // 23 star back
  [255, 247, 204], // 24 star highlight
  [223, 231, 242], // 25 cloud
  [170, 184, 204], // 26 cloud shade
  [78, 168, 222], // 27 rain
  [43, 45, 66], // 28 penguin
  [255, 255, 255], // 29 (unused)
  [255, 183, 3], // 30 beak / feet
  [154, 165, 177], // 31 robot
  [107, 119, 133], // 32 robot dark
  [76, 201, 240], // 33 robot glow
];

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function eyes(s, lx, rx, y, blink) {
  if (blink) {
    s.rect(lx, y + 1, 2, 1, 1);
    s.rect(rx, y + 1, 2, 1, 1);
  } else {
    s.rect(lx, y, 2, 3, 1);
    s.rect(rx, y, 2, 3, 1);
    s.set(lx, y, 2);
    s.set(rx, y, 2);
  }
}

function slime() {
  const N = 12;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const jump = Math.sin(Math.PI * p);
    const squash = (1 - jump) ** 3;
    const rx = 11 + 3 * squash - jump;
    const ry = 9 - 2 * squash + 1.5 * jump;
    const base = 37 - jump * 9;
    const cx = 20;
    const cy = base - ry * 0.85;
    s.ellipse(cx, cy, rx, ry, 4, (x, y) => y <= base);
    s.recolor((x, y) => y > base - 2.5 || (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.6 && x > cx + 2), 5, [4]);
    s.ellipse(cx - rx * 0.45, cy - ry * 0.4, 2.2, 1.5, 6);
    const ey = Math.round(cy);
    eyes(s, cx - 5, cx + 3, ey, i === 6);
    s.rect(cx - 8, ey + 3, 2, 1, 7);
    s.rect(cx + 6, ey + 3, 2, 1, 7);
    s.rect(cx - 1, ey + 3, 2, 1, 1);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 80 };
}

function ghost() {
  const N = 16;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const cx = 20;
    const cy = Math.round(15 + Math.sin(TAU * p) * 2);
    const r = 11;
    const bottom = (x) => cy + 13 + 1.5 * Math.sin(x * 0.9 - TAU * p * 2);
    const wave = Math.sin(TAU * p) * 1.5;
    s.ellipse(cx - 11, cy + 6 + wave, 2.5, 2, 11);
    s.ellipse(cx + 11, cy + 6 - wave, 2.5, 2, 11);
    s.fill(
      (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 <= 1 || (Math.abs(x - cx) <= r && y >= cy && y <= bottom(x)),
      11
    );
    s.recolor((x) => x > cx + 6, 12, [11]);
    eyes(s, cx - 5, cx + 3, cy, i === 11);
    s.rect(cx - 1, cy + 4, 2, 2, 1);
    s.rect(cx - 8, cy + 3, 2, 1, 7);
    s.rect(cx + 6, cy + 3, 2, 1, 7);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 70 };
}

function heart() {
  const N = 12;
  const frames = [];
  const bump = (p, c) => Math.exp(-(((p - c) / 0.07) ** 2));
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const k = 1 + 0.16 * (bump(p, 0.1) + 0.7 * bump(p, 0.35));
    const R = 12 * k;
    const cx = 20;
    const cy = 21;
    s.fill((x, y) => {
      const X = (x - cx) / R;
      const Y = -(y - cy) / R;
      const a = X * X + Y * Y - 1;
      return a * a * a - X * X * Y * Y * Y <= 0;
    }, 13);
    s.recolor((x, y) => (x - cx + (y - cy)) / R > 0.55, 14, [13]);
    s.ellipse(cx - 6 * k, cy - 6 * k, 2.5, 1.8, 15);
    s.set(cx - 7 * k, cy - 7 * k, 2);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 70 };
}

function campfire() {
  const N = 8;
  const frames = [];
  const rand = rng(7);
  const flame = (s, fx, by, w, h, sway, c) =>
    s.fill((x, y) => {
      const t = (by - y) / h;
      if (t < 0 || t > 1) return false;
      const half = w * (t < 0.3 ? Math.sqrt(1 - ((0.3 - t) / 0.3) ** 2) : (1 - t) / 0.7);
      return Math.abs(x - (fx + sway * t * t)) <= half;
    }, c);
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const sway = () => (rand() - 0.5) * 4 + Math.sin(TAU * p) * 1.5;
    const jit = () => 0.9 + 0.2 * rand();
    flame(s, 14, 33, 3.5, 11 * jit(), sway(), 18);
    flame(s, 26, 33, 3.5, 11 * jit(), sway(), 18);
    flame(s, 20, 33, 9, 24 * jit(), sway(), 18);
    flame(s, 20, 33, 6.5, 18 * jit(), sway(), 17);
    flame(s, 20, 33, 4, 12 * jit(), sway(), 16);
    flame(s, 20, 32, 2, 6 * jit(), sway(), 19);
    s.poly([[9, 31], [11, 29], [31, 35], [29, 37]], 20);
    s.poly([[31, 31], [29, 29], [9, 35], [11, 37]], 20);
    s.ellipse(10, 30, 1.5, 1.5, 21);
    s.ellipse(30, 30, 1.5, 1.5, 21);
    s.ellipse(10, 36, 1.5, 1.5, 21);
    s.ellipse(30, 36, 1.5, 1.5, 21);
    s.outline(1);
    for (let k = 0; k < 3; k++) {
      const t = ((i + k * 3) % N) / N;
      s.set(13 + k * 7 + Math.sin(TAU * (t + k * 0.3)) * 2, 18 - t * 16, 16);
    }
    frames.push(s);
  }
  return { frames, delayMs: 90 };
}

function star() {
  const N = 14;
  const frames = [];
  const sparkles = [
    [6, 8, 0],
    [33, 11, 4],
    [8, 32, 8],
    [34, 30, 11],
  ];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const xs = Math.cos(TAU * p);
    const kx = Math.max(0.14, Math.abs(xs));
    const front = xs >= 0;
    const cx = 20;
    const cy = 21;
    const starPts = (outer, inner) =>
      Array.from({ length: 10 }, (_, j) => {
        const a = -Math.PI / 2 + (j * Math.PI) / 5;
        const r = j % 2 ? inner : outer;
        return [cx + Math.cos(a) * r * kx, cy + Math.sin(a) * r];
      });
    s.poly(starPts(15, 6.5), front ? 22 : 23);
    if (front) {
      s.recolor((x, y) => x - cx + (y - cy) > 6 * kx + 3, 23, [22]);
      if (kx > 0.6) {
        const o = Math.round(3 * kx);
        s.rect(cx - o - 1, cy - 1, 1, 2, 1);
        s.rect(cx + o, cy - 1, 1, 2, 1);
        s.rect(cx - 1, cy + 2, 2, 1, 1);
        s.set(cx - o - 2, cy + 1, 7);
        s.set(cx + o + 1, cy + 1, 7);
      }
    }
    s.outline(1);
    for (const [x, y, start] of sparkles) {
      const age = (i - start + N) % N;
      if (age > 3) continue;
      s.set(x, y, 2);
      if (age === 1 || age === 2) {
        s.set(x - 1, y, 22);
        s.set(x + 1, y, 22);
        s.set(x, y - 1, 22);
        s.set(x, y + 1, 22);
      }
    }
    frames.push(s);
  }
  return { frames, delayMs: 70 };
}

function cat() {
  const N = 16;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const sway = Math.sin(TAU * p) * 3;
    for (let t = 0; t <= 1.001; t += 0.04) {
      const x = 25 + 8 * t + sway * t * t;
      const y = 35 - 2 * t - 12 * t * t;
      s.ellipse(x, y, 1.8, 1.8, t > 0.82 ? 10 : 8);
    }
    s.ellipse(20, 29, 9, 8, 8);
    s.ellipse(20, 31, 5, 5.5, 10);
    const twitch = i === 12 || i === 13 ? 1 : 0;
    s.poly([[11, 13], [12, 4], [18, 10]], 8);
    s.poly([[29, 13], [28 + twitch, 4 + twitch], [22, 10]], 8);
    s.poly([[12.5, 11], [13, 6.5], [16, 10]], 7);
    s.poly([[27.5, 11], [27 + twitch, 6.5 + twitch], [24, 10]], 7);
    s.ellipse(20, 16, 10, 7.5, 8);
    s.ellipse(20, 19.5, 3.5, 2, 10);
    s.rect(19, 9, 2, 3, 9);
    s.rect(16, 10, 1, 2, 9);
    s.rect(23, 10, 1, 2, 9);
    eyes(s, 15, 23, 14, i === 9 || i === 10);
    s.rect(19, 18, 2, 1, 7);
    s.rect(12, 18, 2, 1, 7);
    s.rect(26, 18, 2, 1, 7);
    s.ellipse(16, 36.5, 3, 1.6, 10);
    s.ellipse(24, 36.5, 3, 1.6, 10);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 90 };
}

function penguin() {
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const sx = Math.round(Math.sin(TAU * p) * 1.5);
    const bob = i % 4 === 1 || i % 4 === 2 ? -1 : 0;
    const leftUp = i < N / 2 ? 1 : 0;
    s.ellipse(15, 36.3 - leftUp, 3.2, 1.6, 30);
    s.ellipse(25, 36.3 - (1 - leftUp), 3.2, 1.6, 30);
    const cx = 20 + sx;
    s.ellipse(cx - 10, 24 + bob + leftUp, 2.4, 6.5, 28);
    s.ellipse(cx + 10, 24 + bob + (1 - leftUp), 2.4, 6.5, 28);
    s.ellipse(cx, 21 + bob, 10, 14, 28);
    s.ellipse(cx, 26 + bob, 7, 9.5, 2);
    s.ellipse(cx - 4, 15 + bob, 2.6, 3, 2);
    s.ellipse(cx + 4, 15 + bob, 2.6, 3, 2);
    if (i === 5) {
      s.rect(cx - 5, 16 + bob, 2, 1, 1);
      s.rect(cx + 3, 16 + bob, 2, 1, 1);
    } else {
      s.rect(cx - 4, 14 + bob, 1, 2, 1);
      s.rect(cx + 3, 14 + bob, 1, 2, 1);
    }
    s.poly([[cx - 2, 18 + bob], [cx + 2, 18 + bob], [cx, 21 + bob]], 30);
    s.rect(cx - 7, 19 + bob, 2, 1, 7);
    s.rect(cx + 5, 19 + bob, 2, 1, 7);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 110 };
}

function raincloud() {
  const N = 10;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const b = Math.round(Math.sin(TAU * p));
    [11, 17, 23, 29].forEach((x, k) => {
      const t = (p + k * 0.37) % 1;
      const y = Math.round(25 + t * 11);
      s.rect(x, y, 1, 2, 27);
    });
    s.ellipse(12, 16 + b, 7, 6, 25);
    s.ellipse(21, 12 + b, 8.5, 8, 25);
    s.ellipse(29, 16 + b, 6, 5.5, 25);
    s.ellipse(20, 19 + b, 13, 4.5, 25);
    s.recolor((x, y) => y > 20 + b, 26, [25]);
    s.rect(15, 15 + b, 2, 1, 1);
    s.set(14, 14 + b, 1);
    s.set(17, 14 + b, 1);
    s.rect(24, 15 + b, 2, 1, 1);
    s.set(23, 14 + b, 1);
    s.set(26, 14 + b, 1);
    s.rect(12, 17 + b, 2, 1, 7);
    s.rect(27, 17 + b, 2, 1, 7);
    s.rect(19, 18 + b, 3, 1, 1);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 100 };
}

function robot() {
  const N = 12;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const s = new Sprite(SIZE, SIZE);
    const p = i / N;
    const theta = -(Math.PI * 0.8 + 0.35 * Math.sin(TAU * p));
    const rot = ([x, y]) => [28 + x * Math.cos(theta) - y * Math.sin(theta), 21 + x * Math.sin(theta) + y * Math.cos(theta)];
    s.poly([[-1.5, 0], [1.5, 0], [1.5, 9], [-1.5, 9]].map(rot), 31);
    const [hx, hy] = rot([0, 9.5]);
    s.ellipse(hx, hy, 2.2, 2.2, 32);
    s.rect(9, 21, 3, 9, 31);
    s.ellipse(10.5, 30.5, 2, 2, 32);
    s.rect(15, 32, 4, 4, 32);
    s.rect(21, 32, 4, 4, 32);
    s.rect(14, 36, 5, 2, 31);
    s.rect(21, 36, 5, 2, 31);
    s.rect(13, 20, 14, 12, 31);
    s.rect(16, 23, 8, 5, 32);
    const lights = [13, 22, 33];
    for (let k = 0; k < 3; k++) s.set(17 + k * 2, 25, lights[(k + Math.floor(i / 2)) % 3]);
    s.rect(18, 19, 4, 1, 32);
    s.rect(12, 8, 16, 11, 31);
    s.rect(14, 10, 12, 5, 1);
    const ex = 15 + Math.round((Math.sin(TAU * p) + 1) * 2);
    s.rect(ex, 11, 2, 3, 33);
    s.rect(ex + 4, 11, 2, 3, 33);
    s.rect(16, 16, 8, 1, 32);
    s.rect(20, 5, 1, 3, 32);
    s.ellipse(20.5, 3.5, 1.6, 1.6, i % 4 < 2 ? 13 : 33);
    s.outline(1);
    frames.push(s);
  }
  return { frames, delayMs: 90 };
}

const LIBRARY = {
  slime,
  ghost,
  heart,
  campfire,
  star,
  cat,
  penguin,
  raincloud,
  robot,
};

function build(name) {
  const { frames, delayMs } = LIBRARY[name]();
  const scaled = frames.map((f) => f.scaled(SCALE));
  return { frames, scaled, delayMs, width: scaled[0].w, height: scaled[0].h };
}

if (require.main === module) {
  const outDir = path.join(__dirname, '..', 'assets', 'gifs');
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of Object.keys(LIBRARY)) {
    const { scaled, delayMs, width, height } = build(name);
    const gif = encodeGif({ width, height, palette: PALETTE, frames: scaled.map((f) => f.px), delayMs });
    fs.writeFileSync(path.join(outDir, `${name}.gif`), gif);
    console.log(`${name}.gif  ${scaled.length} frames  ${gif.length} bytes`);
  }
}

module.exports = { LIBRARY, PALETTE, build };
