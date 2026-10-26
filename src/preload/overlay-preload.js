const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  init: () => ipcRenderer.invoke('overlay:init'),
  ready: (w, h) => ipcRenderer.send('overlay:ready', w, h),
  moveTo: (x, y) => ipcRenderer.send('overlay:move', x, y),
  dragEnd: () => ipcRenderer.send('overlay:drag-end'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('overlay:set-ignore', ignore),
  contextMenu: () => ipcRenderer.send('overlay:context-menu'),
  onUpdate: (cb) => ipcRenderer.on('overlay:update', (_e, state) => cb(state)),
});
