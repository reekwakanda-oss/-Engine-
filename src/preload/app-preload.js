const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('anima', {
  listLibrary: () => ipcRenderer.invoke('library:list'),
  addFromPC: () => ipcRenderer.invoke('library:add'),
  importFiles: (files) => ipcRenderer.invoke('library:import-paths', [...files].map((f) => webUtils.getPathForFile(f))),
  removeItem: (id) => ipcRenderer.invoke('library:remove', id),
  renameItem: (id, name) => ipcRenderer.invoke('library:rename', id, name),
  setPrefs: (id, patch) => ipcRenderer.invoke('library:set-prefs', id, patch),
  openLibraryFolder: () => ipcRenderer.invoke('library:open-folder'),

  listOverlays: () => ipcRenderer.invoke('overlays:list'),
  launch: (itemId) => ipcRenderer.invoke('overlays:launch', itemId),
  updateOverlay: (id, patch) => ipcRenderer.invoke('overlays:update', id, patch),
  closeOverlay: (id) => ipcRenderer.invoke('overlays:close', id),
  closeAllOverlays: () => ipcRenderer.invoke('overlays:close-all'),
  onOverlaysChanged: (cb) => ipcRenderer.on('overlays:changed', (_e, list) => cb(list)),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
});
