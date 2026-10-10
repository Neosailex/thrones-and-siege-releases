const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('asedioHost', {
  start: () => ipcRenderer.invoke('host:start'),
  stop: () => ipcRenderer.invoke('host:stop'),
  info: () => ipcRenderer.invoke('host:info'),
});
contextBridge.exposeInMainWorld('launcher', {
  info: () => ipcRenderer.invoke('launcher:info'),
  check: () => ipcRenderer.invoke('launcher:check'),
  update: () => ipcRenderer.invoke('launcher:update'),
  play: () => ipcRenderer.invoke('launcher:play'),
  open: (url) => ipcRenderer.invoke('launcher:open', url),
  onProgress: (cb) => ipcRenderer.on('launcher:progress', (e, p) => cb(p)),
  // agregados (el launcher nuevo los usa si están; los viejos los ignoran)
  ready: () => ipcRenderer.invoke('launcher:ready'),
  win: (action) => ipcRenderer.invoke('launcher:win', action),
  quit: () => ipcRenderer.invoke('launcher:quit'),
  openFolder: () => ipcRenderer.invoke('launcher:folder'),
});
