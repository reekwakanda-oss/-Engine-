// Built-in animations shipped in assets/gifs plus files the user imported into userData/library.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { app } = require('electron');
const { pathToFileURL } = require('node:url');
const store = require('./store');

const BUILTIN_DIR = path.join(__dirname, '..', '..', 'assets', 'gifs');

const BUILTIN = [
  ['slime', 'Bouncy Slime'],
  ['cat', 'Tabby Cat'],
  ['ghost', 'Friendly Ghost'],
  ['penguin', 'Waddling Penguin'],
  ['robot', 'Waving Robot'],
  ['heart', 'Beating Heart'],
  ['star', 'Spinning Star'],
  ['campfire', 'Campfire'],
  ['raincloud', 'Rain Cloud'],
].map(([key, name]) => ({ id: `builtin:${key}`, name, file: path.join(BUILTIN_DIR, `${key}.gif`), builtin: true }));

const MIME = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.apng': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
const EXTENSIONS = Object.keys(MIME).map((e) => e.slice(1));

const userDir = () => path.join(app.getPath('userData'), 'library');

function all() {
  const user = store.get().userItems.map((u) => ({ ...u, file: path.join(userDir(), u.fileName), builtin: false }));
  return [...BUILTIN, ...user];
}

function find(id) {
  return all().find((item) => item.id === id) || null;
}

function toClient(item) {
  return {
    id: item.id,
    name: item.name,
    builtin: item.builtin,
    url: pathToFileURL(item.file).href,
    prefs: store.prefsFor(item.id, item.builtin),
  };
}

function list() {
  return all().map(toClient);
}

function importFiles(paths) {
  fs.mkdirSync(userDir(), { recursive: true });
  const added = [];
  for (const src of paths) {
    const ext = path.extname(src).toLowerCase();
    if (!MIME[ext]) continue;
    const id = `user:${crypto.randomUUID()}`;
    const fileName = `${id.slice(5)}${ext}`;
    fs.copyFileSync(src, path.join(userDir(), fileName));
    const item = { id, name: path.basename(src, path.extname(src)), fileName };
    store.get().userItems.push(item);
    added.push(id);
  }
  store.save();
  return added;
}

function remove(id) {
  const data = store.get();
  const item = data.userItems.find((u) => u.id === id);
  if (!item) return false;
  fs.rmSync(path.join(userDir(), item.fileName), { force: true });
  data.userItems = data.userItems.filter((u) => u.id !== id);
  delete data.itemPrefs[id];
  store.save();
  return true;
}

function rename(id, name) {
  const item = store.get().userItems.find((u) => u.id === id);
  if (!item || !name.trim()) return false;
  item.name = name.trim().slice(0, 80);
  store.save();
  return true;
}

function setPrefs(id, patch) {
  const data = store.get();
  data.itemPrefs[id] = { ...data.itemPrefs[id], ...patch };
  store.save();
}

function readForPlayback(id) {
  const item = find(id);
  if (!item) return null;
  return {
    bytes: fs.readFileSync(item.file),
    mime: MIME[path.extname(item.file).toLowerCase()] || 'image/gif',
    url: pathToFileURL(item.file).href,
  };
}

module.exports = { list, find, toClient, importFiles, remove, rename, setPrefs, readForPlayback, EXTENSIONS, userDir };
