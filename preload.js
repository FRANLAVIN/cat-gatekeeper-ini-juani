const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('catGatekeeper', {
  getInitial: () => ipcRenderer.invoke('get-initial'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  start: () => ipcRenderer.invoke('start-tracking'),
  stop: () => ipcRenderer.invoke('stop-tracking'),
  reset: () => ipcRenderer.invoke('reset-timers'),
  testOverlay: (animal) => ipcRenderer.invoke('test-overlay', animal),
  getActive: () => ipcRenderer.invoke('get-active'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
  onLog: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on('log', listener);
    return () => ipcRenderer.removeListener('log', listener);
  }
});
