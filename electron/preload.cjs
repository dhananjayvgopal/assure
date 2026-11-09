const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assurePos', {
  printSilently: (options) => ipcRenderer.invoke('assure-pos:print-silently', options),
  saveAsPdf: (options) => ipcRenderer.invoke('assure-pos:save-as-pdf', options),
});
