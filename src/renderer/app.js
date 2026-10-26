const api = window.anima;
const $ = (sel) => document.querySelector(sel);

const ANCHORS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const fmt = {
  scale: (v) => `${+v}×`,
  speed: (v) => `${+v}×`,
  opacity: (v) => `${Math.round(v * 100)}%`,
  bgTolerance: (v) => `${v}`,
};

const SLIDERS = ['scale', 'speed', 'opacity', 'bgTolerance'];

let items = [];
let selectedId = null;
let filter = 'all';
let query = '';
let overlays = [];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function anchorGrid(onPick, selected) {
  return el(
    'div',
    { class: 'anchors' },
    ...ANCHORS.map((a) =>
      el('button', {
        title: a.replace('-', ' '),
        className: a === selected ? 'selected' : '',
        onclick: () => onPick(a),
      })
    )
  );
}

// ---------------- tabs ----------------

document.querySelectorAll('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${tab.dataset.tab}`));
  })
);

// ---------------- library ----------------

const selected = () => items.find((i) => i.id === selectedId);

async function refreshLibrary(selectId) {
  items = await api.listLibrary();
  if (selectId) selectedId = selectId;
  if (!selected()) selectedId = items[0]?.id ?? null;
  renderGrid();
  renderPanel();
}

function visibleItems() {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (filter === 'all' || (filter === 'builtin') === i.builtin) &&
      (!q || i.name.toLowerCase().includes(q))
  );
}

function renderGrid() {
  const list = visibleItems();
  $('#grid').replaceChildren(
    ...list.map((item) =>
      el(
        'button',
        {
          class: `card${item.id === selectedId ? ' selected' : ''}`,
          title: 'Double-click to launch',
          onclick: () => {
            selectedId = item.id;
            renderGrid();
            renderPanel();
          },
          ondblclick: () => api.launch(item.id),
        },
        el('div', { class: 'thumb' }, el('img', { src: item.url, alt: '', className: item.prefs.crisp ? 'crisp' : '' })),
        el(
          'div',
          { class: 'meta' },
          el('span', { class: 'name', textContent: item.name, title: item.name }),
          el('span', { class: 'badge', textContent: item.builtin ? 'Built-in' : 'Mine' })
        )
      )
    )
  );
  if (!list.length) $('#grid').append(el('p', { class: 'muted', textContent: 'No animations match.' }));
}

function renderPanel() {
  const item = selected();
  $('#panel').classList.toggle('hidden', !item);
  if (!item) return;
  const { prefs } = item;
  $('#preview-img').src = item.url;
  $('#preview-img').classList.toggle('crisp', prefs.crisp);
  $('#item-name').value = item.name;
  $('#item-name').readOnly = item.builtin;
  $('#item-name').title = item.builtin ? '' : 'Click to rename';
  $('#item-badge').textContent = item.builtin ? 'Built-in' : 'Mine';
  for (const key of SLIDERS) {
    $(`#${key}`).value = prefs[key];
    $(`#${key}-out`).textContent = fmt[key](prefs[key]);
  }
  document.querySelectorAll('#bg-mode button').forEach((b) => b.classList.toggle('selected', b.dataset.mode === prefs.bgMode));
  $('#bg-tolerance-field').classList.toggle('hidden', prefs.bgMode === 'keep');
  $('#flip').checked = prefs.flip;
  $('#crisp').checked = prefs.crisp;
  $('#anchors').replaceWith(
    Object.assign(anchorGrid((a) => savePrefs({ anchor: a }), prefs.anchor), { id: 'anchors' })
  );
  $('#anchor-last').classList.toggle('selected', prefs.anchor === 'last');
  $('#anchor-last').disabled = prefs.lastX == null;
  $('#delete-btn').classList.toggle('hidden', item.builtin);
}

async function savePrefs(patch) {
  const item = selected();
  if (!item) return;
  Object.assign(item.prefs, patch);
  await api.setPrefs(item.id, patch);
  renderPanel();
  if ('crisp' in patch) renderGrid();
}

for (const key of SLIDERS) {
  const input = $(`#${key}`);
  input.addEventListener('input', () => ($(`#${key}-out`).textContent = fmt[key](input.value)));
  input.addEventListener('change', () => savePrefs({ [key]: Number(input.value) }));
}
document.querySelectorAll('#bg-mode button').forEach((b) =>
  b.addEventListener('click', () => savePrefs({ bgMode: b.dataset.mode }))
);
$('#flip').addEventListener('change', (e) => savePrefs({ flip: e.target.checked }));
$('#crisp').addEventListener('change', (e) => savePrefs({ crisp: e.target.checked }));
$('#anchor-last').addEventListener('click', () => savePrefs({ anchor: 'last' }));

$('#item-name').addEventListener('change', async (e) => {
  const item = selected();
  if (item && !item.builtin && (await api.renameItem(item.id, e.target.value))) refreshLibrary();
});

$('#launch-btn').addEventListener('click', async () => {
  const item = selected();
  if (!item) return;
  await api.launch(item.id);
  const btn = $('#launch-btn');
  btn.textContent = '✓ Launched';
  setTimeout(() => (btn.textContent = '▶ Launch animation'), 1200);
});

$('#delete-btn').addEventListener('click', async () => {
  const item = selected();
  if (!item || item.builtin) return;
  const btn = $('#delete-btn');
  if (btn.dataset.confirm !== item.id) {
    btn.dataset.confirm = item.id;
    btn.textContent = 'Click again to delete';
    setTimeout(() => {
      delete btn.dataset.confirm;
      btn.textContent = 'Delete from library';
    }, 2500);
    return;
  }
  delete btn.dataset.confirm;
  btn.textContent = 'Delete from library';
  await api.removeItem(item.id);
  refreshLibrary();
});

$('#add-btn').addEventListener('click', async () => {
  const added = await api.addFromPC();
  if (added.length) refreshLibrary(added[0]);
});

$('#search').addEventListener('input', (e) => {
  query = e.target.value;
  renderGrid();
});

document.querySelectorAll('.chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderGrid();
  })
);

// drag & drop import
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (++dragDepth === 1) $('#drop').classList.remove('hidden');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth === 0) $('#drop').classList.add('hidden');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop').classList.add('hidden');
  const added = await api.importFiles(e.dataTransfer.files);
  if (added.length) refreshLibrary(added[0]);
});

// ---------------- on-screen overlays ----------------

function overlayRow(o) {
  const update = (patch) => api.updateOverlay(o.id, patch);
  const slider = (key, min, max, step, label = key[0].toUpperCase() + key.slice(1)) => {
    const out = el('output', { textContent: fmt[key](o[key]) });
    const input = el('input', {
      type: 'range',
      min,
      max,
      step,
      value: o[key],
      oninput: () => {
        out.textContent = fmt[key](input.value);
        update({ [key]: Number(input.value) });
      },
    });
    input.dataset.key = key;
    return el('div', { class: 'mini' }, el('label', {}, label, out), input);
  };
  const coord = (key) => {
    const input = el('input', {
      type: 'number',
      step: 1,
      value: o[key] ?? '',
      oninput: () => input.value !== '' && update({ [key]: Math.round(Number(input.value)) }),
    });
    input.dataset.key = key;
    return el('label', { class: 'pos' }, el('span', { textContent: key.toUpperCase() }), input);
  };
  const bgSelect = el(
    'select',
    { onchange: () => update({ bgMode: bgSelect.value }) },
    ...[['auto', 'Auto'], ['remove', 'Remove white'], ['keep', 'Keep']].map(([value, textContent]) =>
      el('option', { value, textContent })
    )
  );
  bgSelect.value = o.bgMode ?? 'auto';
  bgSelect.dataset.key = 'bgMode';
  const check = (key, label) => {
    const input = el('input', { type: 'checkbox', checked: !!o[key], onchange: () => update({ [key]: input.checked }) });
    input.dataset.key = key;
    return el('label', { class: 'check' }, input, label);
  };

  const row = el(
    'div',
    { class: 'overlay-row' },
    el('div', { class: 'thumb' }, el('img', { src: o.url, alt: '', className: o.crisp ? 'crisp' : '' })),
    el(
      'div',
      { class: 'controls' },
      el('div', { class: 'title' }, o.name, el('span', { class: 'badge', textContent: o.width ? `${o.width}×${o.height}` : '…' })),
      el('div', { class: 'pos' }, coord('x'), coord('y')),
      el('div', { class: 'anchor-row' }, el('span', { class: 'muted', textContent: 'Snap' }), anchorGrid((a) => update({ anchor: a }))),
      slider('scale', 0.25, 4, 0.25),
      slider('speed', 0.25, 3, 0.25),
      slider('opacity', 0.1, 1, 0.05),
      el('div', { class: 'mini' }, el('label', {}, 'White background'), bgSelect),
      slider('bgTolerance', 5, 120, 5, 'Removal strength'),
      el('div', { class: 'toggles' }, check('flip', 'Mirror'), check('locked', 'Lock (click-through)'))
    ),
    el('div', { class: 'row-actions' }, el('button', { class: 'btn danger', textContent: 'Close', onclick: () => api.closeOverlay(o.id) }))
  );
  row.dataset.id = o.id;
  return row;
}

// Refresh values in place so the inputs the user is typing into aren't rebuilt under them.
function syncRow(row, o) {
  row.querySelector('.title .badge').textContent = o.width ? `${o.width}×${o.height}` : '…';
  row.querySelectorAll('[data-key]').forEach((input) => {
    if (input === document.activeElement) return;
    const v = o[input.dataset.key];
    if (input.type === 'checkbox') input.checked = !!v;
    else input.value = v ?? '';
    const out = input.parentElement.querySelector('output');
    if (out) out.textContent = fmt[input.dataset.key](v);
  });
}

function renderActive(list) {
  overlays = list;
  $('#active-count').textContent = list.length;
  $('#active-empty').classList.toggle('hidden', list.length > 0);
  $('#close-all').classList.toggle('hidden', list.length === 0);
  const container = $('#active-list');
  const rows = [...container.children];
  const sameSet = rows.length === list.length && rows.every((r, i) => r.dataset.id === list[i].id);
  if (sameSet) rows.forEach((r, i) => syncRow(r, list[i]));
  else container.replaceChildren(...list.map(overlayRow));
}

$('#close-all').addEventListener('click', () => api.closeAllOverlays());
api.onOverlaysChanged(renderActive);

// ---------------- settings ----------------

async function loadSettings() {
  const s = await api.getSettings();
  $('#set-login').checked = s.launchAtLogin;
  $('#set-restore').checked = s.restoreOnStartup;
  $('#shortcut').textContent = s.unlockShortcut.replace('CommandOrControl', navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl');
  $('#version').textContent = `AnimaEngine v${s.version}`;
}

$('#set-login').addEventListener('change', (e) => api.setSettings({ launchAtLogin: e.target.checked }));
$('#set-restore').addEventListener('change', (e) => api.setSettings({ restoreOnStartup: e.target.checked }));
$('#open-folder').addEventListener('click', () => api.openLibraryFolder());

// ---------------- boot ----------------

refreshLibrary();
api.listOverlays().then(renderActive);
loadSettings();
