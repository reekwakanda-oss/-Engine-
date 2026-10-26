// JSON-file persistence for settings, the user's library, per-animation defaults and open overlays.

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const DEFAULT_PREFS = {
  scale: 1,
  speed: 1,
  opacity: 1,
  flip: false,
  crisp: true,
  bgMode: 'auto', // 'auto' | 'remove' | 'keep' — strip a white background
  bgTolerance: 40,
  anchor: 'bottom-center',
  lastX: null,
  lastY: null,
};

const DEFAULTS = {
  settings: {
    launchAtLogin: false,
    restoreOnStartup: true,
  },
  userItems: [],
  itemPrefs: {},
  overlays: [],
};

const file = () => path.join(app.getPath('userData'), 'config.json');

let data = null;
let saveTimer = null;

function load() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {
    // first run or unreadable config: start from defaults
  }
  data = {
    ...structuredClone(DEFAULTS),
    ...raw,
    settings: { ...DEFAULTS.settings, ...raw.settings },
  };
  return data;
}

function get() {
  return data || load();
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(data, null, 2));
}

function save() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 300);
}

function prefsFor(itemId, builtin) {
  return { ...DEFAULT_PREFS, crisp: builtin, ...get().itemPrefs[itemId] };
}

module.exports = { get, save, saveNow, prefsFor, DEFAULT_PREFS };
