// Creates and manages the transparent, always-on-top windows that play animations on the desktop.

const path = require('node:path');
const crypto = require('node:crypto');
const { BrowserWindow, Menu, screen } = require('electron');
const store = require('./store');
const library = require('./library');

const entries = new Map(); // overlay id -> { state, win, natural }
let quitting = false;
let listener = () => {};
let notifyTimer = null;
let displayHint = () => screen.getPrimaryDisplay();

const EDITABLE = ['x', 'y', 'scale', 'speed', 'opacity', 'flip', 'crisp', 'locked', 'bgMode', 'bgTolerance'];

function onChange(fn) {
  listener = fn;
}

function setDisplayHint(fn) {
  displayHint = fn;
}

function notify() {
  if (!notifyTimer) {
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      listener(list());
    }, 40);
  }
}

function persist() {
  if (quitting) return;
  store.get().overlays = [...entries.values()].map((e) => e.state);
  store.save();
}

function list() {
  return [...entries.values()].map(({ state, natural }) => {
    const item = library.find(state.itemId);
    return {
      ...state,
      name: item ? item.name : 'Missing file',
      url: item ? library.toClient(item).url : '',
      width: natural ? Math.round(natural.w * state.scale) : null,
      height: natural ? Math.round(natural.h * state.scale) : null,
    };
  });
}

function size(entry) {
  const { natural, state } = entry;
  return {
    width: Math.max(8, Math.round(natural.w * state.scale)),
    height: Math.max(8, Math.round(natural.h * state.scale)),
  };
}

function anchorPosition(anchor, width, height, display = displayHint()) {
  const area = display.workArea;
  const [row, col] = anchor === 'center' ? ['center', 'center'] : anchor.split('-');
  const x = { left: area.x, center: area.x + (area.width - width) / 2, right: area.x + area.width - width }[col];
  const y = { top: area.y, center: area.y + (area.height - height) / 2, bottom: area.y + area.height - height }[row];
  return { x: Math.round(x), y: Math.round(y) };
}

function applyBounds(entry) {
  if (!entry.natural || entry.win.isDestroyed()) return;
  const { width, height } = size(entry);
  entry.win.setBounds({ x: Math.round(entry.state.x), y: Math.round(entry.state.y), width, height });
}

function applyMouseMode(entry, ignore = false) {
  if (entry.win.isDestroyed()) return;
  if (entry.state.locked) entry.win.setIgnoreMouseEvents(true);
  else entry.win.setIgnoreMouseEvents(ignore, { forward: true });
}

function rememberPosition(state) {
  library.setPrefs(state.itemId, { lastX: state.x, lastY: state.y });
}

// Windows/Linux: other "topmost" windows (taskbar, games, players) can bury an overlay; keep raising them.
if (process.platform !== 'darwin') {
  setInterval(() => {
    for (const { win } of entries.values()) {
      if (win.isDestroyed() || !win.isVisible()) continue;
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    }
  }, 2000).unref?.();
}

function createWindow(state) {
  const win = new BrowserWindow({
    width: 64,
    height: 64,
    x: state.x ?? undefined,
    y: state.y ?? undefined,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'overlay-preload.js'),
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  // skipTransformProcessType: the transform races when several overlays open at once, leaving some
  // of them behind when you switch to a full-screen app.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  win.loadFile(path.join(__dirname, '..', 'overlay', 'overlay.html'));

  const entry = { state, win, natural: null };
  entries.set(state.id, entry);
  win.on('closed', () => {
    if (quitting) return;
    entries.delete(state.id);
    persist();
    notify();
  });
  return entry;
}

function launch(itemId, overrides = {}) {
  const item = library.find(itemId);
  if (!item) return null;
  const prefs = store.prefsFor(itemId, item.builtin);
  const state = {
    id: crypto.randomUUID(),
    itemId,
    x: null,
    y: null,
    scale: prefs.scale,
    speed: prefs.speed,
    opacity: prefs.opacity,
    flip: prefs.flip,
    crisp: prefs.crisp,
    bgMode: prefs.bgMode,
    bgTolerance: prefs.bgTolerance,
    locked: false,
    anchor: prefs.anchor,
    ...overrides,
  };
  if (state.x == null && prefs.anchor === 'last' && prefs.lastX != null) {
    state.x = prefs.lastX;
    state.y = prefs.lastY;
  }
  createWindow(state);
  persist();
  notify();
  return state.id;
}

function restoreSaved() {
  for (const saved of store.get().overlays) {
    if (library.find(saved.itemId)) createWindow({ ...saved });
  }
  persist();
}

function update(id, patch) {
  const entry = entries.get(id);
  if (!entry) return;
  const { state } = entry;
  for (const key of EDITABLE) if (key in patch) state[key] = patch[key];
  if ('anchor' in patch && entry.natural) {
    const { width, height } = size(entry);
    Object.assign(state, anchorPosition(patch.anchor, width, height, screen.getDisplayMatching(entry.win.getBounds())));
  }
  applyBounds(entry);
  if ('locked' in patch) applyMouseMode(entry);
  if ('x' in patch || 'y' in patch || 'anchor' in patch) rememberPosition(state);
  entry.win.webContents.send('overlay:update', state);
  persist();
  notify();
}

function close(id) {
  const entry = entries.get(id);
  if (entry && !entry.win.isDestroyed()) entry.win.close();
}

function closeAll() {
  for (const id of [...entries.keys()]) close(id);
}

function unlockAll() {
  for (const [id, entry] of entries) if (entry.state.locked) update(id, { locked: false });
}

function fromSender(sender) {
  for (const entry of entries.values()) if (!entry.win.isDestroyed() && entry.win.webContents === sender) return entry;
  return null;
}

// ---- messages from overlay windows ----

function handleInit(sender) {
  const entry = fromSender(sender);
  if (!entry) return null;
  const media = library.readForPlayback(entry.state.itemId);
  return media && { ...media, state: entry.state };
}

function handleReady(sender, w, h) {
  const entry = fromSender(sender);
  if (!entry) return;
  entry.natural = { w, h };
  if (entry.state.x == null) {
    const { width, height } = size(entry);
    Object.assign(entry.state, anchorPosition(entry.state.anchor || 'bottom-center', width, height));
  }
  applyBounds(entry);
  applyMouseMode(entry);
  entry.win.showInactive();
  persist();
  notify();
}

function handleMove(sender, x, y) {
  const entry = fromSender(sender);
  if (!entry) return;
  entry.state.x = Math.round(x);
  entry.state.y = Math.round(y);
  applyBounds(entry);
  notify();
}

function handleDragEnd(sender) {
  const entry = fromSender(sender);
  if (!entry) return;
  rememberPosition(entry.state);
  persist();
}

function handleIgnore(sender, ignore) {
  const entry = fromSender(sender);
  if (entry) applyMouseMode(entry, ignore);
}

function handleContextMenu(sender, showMain) {
  const entry = fromSender(sender);
  if (!entry) return;
  const { state } = entry;
  const item = library.find(state.itemId);
  const id = state.id;
  Menu.buildFromTemplate([
    { label: item ? item.name : 'Animation', enabled: false },
    { type: 'separator' },
    {
      label: 'Size',
      submenu: [0.5, 0.75, 1, 1.5, 2, 3].map((s) => ({
        label: `${s}×`,
        type: 'radio',
        checked: state.scale === s,
        click: () => update(id, { scale: s }),
      })),
    },
    {
      label: 'Move to',
      submenu: [
        ['Top left', 'top-left'],
        ['Top right', 'top-right'],
        ['Center', 'center'],
        ['Bottom left', 'bottom-left'],
        ['Bottom center', 'bottom-center'],
        ['Bottom right', 'bottom-right'],
      ].map(([label, anchor]) => ({ label, click: () => update(id, { anchor }) })),
    },
    { label: 'Mirror', type: 'checkbox', checked: state.flip, click: () => update(id, { flip: !state.flip }) },
    { label: 'Lock (click-through)', click: () => update(id, { locked: true }) },
    { type: 'separator' },
    { label: 'Open AnimaEngine', click: showMain },
    { label: 'Close animation', click: () => close(id) },
  ]).popup({ window: entry.win });
}

function setQuitting() {
  quitting = true;
  store.get().overlays = [...entries.values()].map((e) => e.state);
  store.saveNow();
}

function closeForItem(itemId) {
  for (const [id, entry] of entries) if (entry.state.itemId === itemId) close(id);
}

module.exports = {
  onChange,
  setDisplayHint,
  list,
  launch,
  restoreSaved,
  update,
  close,
  closeAll,
  closeForItem,
  unlockAll,
  setQuitting,
  handleInit,
  handleReady,
  handleMove,
  handleDragEnd,
  handleIgnore,
  handleContextMenu,
};
