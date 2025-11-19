const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  setMasterKey: (key) => ipcRenderer.invoke('set-master-key', key),
  getMasterKey: () => ipcRenderer.invoke('get-master-key'),
  clearMasterKey: () => ipcRenderer.invoke('clear-master-key'),
});
