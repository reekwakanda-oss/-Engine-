const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, screen, shell, globalShortcut } = require('electron');
const store = require('./store');
const library = require('./library');
const overlays = require('./overlays');

const UNLOCK_SHORTCUT = 'CommandOrControl+Shift+U';

let mainWindow = null;

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 820,
    minHeight: 560,
    title: 'AnimaEngine',
    backgroundColor: '#12151c',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'app-preload.js'),
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function sendToMain(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function applySettings() {
  const { launchAtLogin } = store.get().settings;
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: launchAtLogin });
  }
}

function registerIpc() {
  // main window
  ipcMain.handle('library:list', () => library.list());
  ipcMain.handle('library:add', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add animations',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Animations', extensions: library.EXTENSIONS }],
    });
    return result.canceled ? [] : library.importFiles(result.filePaths);
  });
  ipcMain.handle('library:import-paths', (_e, paths) => library.importFiles(paths));
  ipcMain.handle('library:remove', (_e, id) => {
    overlays.closeForItem(id);
    return library.remove(id);
  });
  ipcMain.handle('library:rename', (_e, id, name) => library.rename(id, name));
  ipcMain.handle('library:set-prefs', (_e, id, patch) => library.setPrefs(id, patch));
  ipcMain.handle('library:open-folder', () => shell.openPath(library.userDir()));

  ipcMain.handle('overlays:list', () => overlays.list());
  ipcMain.handle('overlays:launch', (_e, itemId) => overlays.launch(itemId));
  ipcMain.handle('overlays:update', (_e, id, patch) => overlays.update(id, patch));
  ipcMain.handle('overlays:close', (_e, id) => overlays.close(id));
  ipcMain.handle('overlays:close-all', () => overlays.closeAll());

  ipcMain.handle('settings:get', () => ({ ...store.get().settings, unlockShortcut: UNLOCK_SHORTCUT, version: app.getVersion() }));
  ipcMain.handle('settings:set', (_e, patch) => {
    Object.assign(store.get().settings, patch);
    store.save();
    applySettings();
  });

  // overlay windows
  ipcMain.handle('overlay:init', (e) => overlays.handleInit(e.sender));
  ipcMain.on('overlay:ready', (e, w, h) => overlays.handleReady(e.sender, w, h));
  ipcMain.on('overlay:move', (e, x, y) => overlays.handleMove(e.sender, x, y));
  ipcMain.on('overlay:drag-end', (e) => overlays.handleDragEnd(e.sender));
  ipcMain.on('overlay:set-ignore', (e, ignore) => overlays.handleIgnore(e.sender, ignore));
  ipcMain.on('overlay:context-menu', (e) => overlays.handleContextMenu(e.sender, showMain));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMain);

  app.whenReady().then(() => {
    store.get();
    registerIpc();
    overlays.onChange((list) => sendToMain('overlays:changed', list));
    overlays.setDisplayHint(() =>
      mainWindow && !mainWindow.isDestroyed()
        ? screen.getDisplayMatching(mainWindow.getBounds())
        : screen.getPrimaryDisplay()
    );
    globalShortcut.register(UNLOCK_SHORTCUT, () => {
      overlays.unlockAll();
      showMain();
    });

    createMainWindow();
    if (store.get().settings.restoreOnStartup) overlays.restoreSaved();
    else store.get().overlays = [];

    app.on('activate', showMain);
  });

  app.on('before-quit', () => overlays.setQuitting());
  app.on('will-quit', () => globalShortcut.unregisterAll());

  // Overlays keep the app alive; quit once nothing at all is open (except on macOS, where apps idle in the dock).
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
