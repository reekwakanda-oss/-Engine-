// Tiny indexed-color canvas for drawing pixel-art frames. Shapes are tested at pixel centers.

function inPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

class Sprite {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }

  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  fill(pred, c) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (pred(x + 0.5, y + 0.5)) this.px[y * this.w + x] = c;
  }

  ellipse(cx, cy, rx, ry, c, clip) {
    this.fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!clip || clip(x, y)), c);
  }

  poly(pts, c) {
    this.fill((x, y) => inPolygon(pts, x, y), c);
  }

  // Repaint already-drawn pixels matching `pred` (optionally only those currently in `only`).
  recolor(pred, c, only) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const cur = this.px[i];
        if (cur !== 0 && (!only || only.includes(cur)) && pred(x + 0.5, y + 0.5)) this.px[i] = c;
      }
  }

  // Paint a 1px border around every shape (transparent pixels touching an opaque one).
  outline(c) {
    const src = this.px.slice();
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!src[y * this.w + x] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)))
          this.px[y * this.w + x] = c;
  }

  scaled(k) {
    const w = this.w * k;
    const out = new Uint8Array(w * this.h * k);
    for (let y = 0; y < this.h * k; y++)
      for (let x = 0; x < w; x++) out[y * w + x] = this.px[Math.floor(y / k) * this.w + Math.floor(x / k)];
    return { w, h: this.h * k, px: out };
  }
}

module.exports = { Sprite };
