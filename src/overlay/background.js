// White-background removal. Flood-fills near-white pixels starting from the image border, so white
// details inside the character (eyes, highlights) are kept, then softens the leftover light fringe.

function whiteDistance(d, i) {
  return 255 - Math.min(d[i], d[i + 1], d[i + 2]);
}

// True when most corners are opaque and near-white, i.e. the image was saved on a white backdrop.
function hasWhiteBackground(img, tolerance) {
  const { width: w, height: h, data: d } = img;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const white = corners.filter((p) => d[p * 4 + 3] >= 250 && whiteDistance(d, p * 4) <= tolerance);
  return white.length >= 3;
}

function stripWhiteBackground(img, tolerance) {
  const { width: w, height: h, data: d } = img;
  const tol = Math.max(1, tolerance);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (p) => {
    if (seen[p]) return;
    if (d[p * 4 + 3] >= 16 && whiteDistance(d, p * 4) > tol) return;
    seen[p] = 1;
    stack.push(p);
  };

  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }

  // Anti-aliased edges blend into white; fade those light pixels instead of leaving a halo.
  for (let p = 0; p < w * h; p++) {
    if (seen[p]) continue;
    const x = p % w;
    const touches = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (p >= w && seen[p - w]) || (p < w * (h - 1) && seen[p + w]);
    if (!touches) continue;
    const dist = whiteDistance(d, p * 4);
    if (dist < tol * 3) d[p * 4 + 3] = Math.round(d[p * 4 + 3] * Math.max(0.15, (dist - tol) / (tol * 2)));
  }
  return img;
}
