// Plays one animation on a transparent canvas. Frames are decoded up-front with WebCodecs'
// ImageDecoder so playback speed can be changed; transparent pixels let mouse clicks through.

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let state = null;
let rawFrames = []; // { bitmap, duration (ms) } as decoded
let frames = []; // what is drawn: rawFrames, or copies with the background removed
let bgKey = null;
let bgTimer = null;
let frameIndex = 0;
let elapsed = 0;
let lastTick = 0;
let drag = null;
let ignoring = null;

async function decodeFrames(bytes, mime) {
  const decoder = new ImageDecoder({ data: bytes, type: mime });
  await decoder.tracks.ready;
  await decoder.completed;
  const count = decoder.tracks.selectedTrack.frameCount;
  const out = [];
  for (let i = 0; i < count; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    const ms = (image.duration ?? 0) / 1000;
    // Browsers treat GIF delays <= 10ms as 100ms; match that.
    out.push({ bitmap: await createImageBitmap(image), duration: ms > 10 ? ms : 100 });
    image.close();
  }
  decoder.close();
  return out;
}

async function decodeStill(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return [{ bitmap: await createImageBitmap(img), duration: Infinity }];
}

async function processBackground() {
  const mode = state.bgMode ?? 'auto';
  const tolerance = state.bgTolerance ?? 40;
  const key = `${mode}:${tolerance}`;
  if (key === bgKey) return;
  bgKey = key;

  const { width: w, height: h } = canvas;
  const scratch = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
  const read = (bitmap) => {
    scratch.clearRect(0, 0, w, h);
    scratch.drawImage(bitmap, 0, 0);
    return scratch.getImageData(0, 0, w, h);
  };

  const remove = mode === 'remove' || (mode === 'auto' && hasWhiteBackground(read(rawFrames[0].bitmap), tolerance));
  let next = rawFrames;
  if (remove) {
    next = [];
    for (const f of rawFrames) {
      next.push({ bitmap: await createImageBitmap(stripWhiteBackground(read(f.bitmap), tolerance)), duration: f.duration });
      if (bgKey !== key) return next.forEach((n) => n.bitmap.close()); // superseded by a newer setting
    }
  }
  if (frames !== rawFrames) frames.forEach((f) => f.bitmap.close());
  frames = next;
  draw();
}

function applyState(next) {
  state = next;
  canvas.style.opacity = state.opacity;
  canvas.classList.toggle('crisp', !!state.crisp);
  draw();
  // Debounced so dragging the tolerance slider doesn't reprocess every frame on every tick.
  clearTimeout(bgTimer);
  bgTimer = setTimeout(processBackground, 120);
}

function draw() {
  const frame = frames[frameIndex];
  if (!frame) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.flip) ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
  ctx.drawImage(frame.bitmap, 0, 0);
}

function tick(now) {
  const dt = lastTick ? now - lastTick : 0;
  lastTick = now;
  if (frames.length > 1 && state.speed > 0) {
    elapsed += dt * state.speed;
    let changed = false;
    while (elapsed >= frames[frameIndex].duration) {
      elapsed -= frames[frameIndex].duration;
      frameIndex = (frameIndex + 1) % frames.length;
      changed = true;
    }
    if (changed) draw();
  }
  requestAnimationFrame(tick);
}

function setIgnore(ignore) {
  if (ignore === ignoring) return;
  ignoring = ignore;
  window.overlay.setIgnoreMouse(ignore);
}

// Let clicks fall through to the desktop wherever the animation is transparent.
function hitTest(e) {
  if (drag) return;
  const x = Math.floor((e.offsetX / canvas.clientWidth) * canvas.width);
  const y = Math.floor((e.offsetY / canvas.clientHeight) * canvas.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return setIgnore(true);
  setIgnore(ctx.getImageData(x, y, 1, 1).data[3] < 16);
}

canvas.addEventListener('mousemove', hitTest);
canvas.addEventListener('mouseleave', () => !drag && setIgnore(true));

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  drag = { dx: e.screenX - window.screenX, dy: e.screenY - window.screenY, pending: null };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const first = !drag.pending;
  drag.pending = [e.screenX - drag.dx, e.screenY - drag.dy];
  if (first)
    requestAnimationFrame(() => {
      if (!drag || !drag.pending) return;
      window.overlay.moveTo(...drag.pending);
      drag.pending = null;
    });
});

function endDrag() {
  if (!drag) return;
  if (drag.pending) window.overlay.moveTo(...drag.pending);
  drag = null;
  canvas.classList.remove('dragging');
  window.overlay.dragEnd();
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.overlay.contextMenu();
});

window.overlay.onUpdate(applyState);

(async () => {
  const media = await window.overlay.init();
  if (!media) return window.close();
  try {
    rawFrames = await decodeFrames(media.bytes, media.mime);
  } catch (err) {
    console.warn('ImageDecoder failed, showing first frame only', err);
    rawFrames = await decodeStill(media.url);
  }
  frames = rawFrames;
  canvas.width = frames[0].bitmap.width;
  canvas.height = frames[0].bitmap.height;
  state = media.state;
  await processBackground(); // before showing, so a white box never flashes on screen
  applyState(media.state);
  window.overlay.ready(canvas.width, canvas.height);
  requestAnimationFrame(tick);
})();
