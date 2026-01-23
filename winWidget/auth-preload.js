const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('authCallback', {
  sendTokens: (data) => ipcRenderer.send('auth:callback-tokens', data),
  sendError: (msg) => ipcRenderer.send('auth:callback-error', String(msg))
});
