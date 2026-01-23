const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  toggle: () => ipcRenderer.invoke('widget:toggle'),
  getState: () => ipcRenderer.invoke('widget:getState'),
  onState: (callback) => {
    ipcRenderer.on('widget:state-changed', (event, isExpanded) => {
      callback(isExpanded);
    });
  },
  toggleSettings: () => ipcRenderer.invoke('widget:toggleSettings'),
  getSettingsState: () => ipcRenderer.invoke('widget:getSettingsState'),
  onSettingsState: (callback) => {
    ipcRenderer.on('widget:settings-state-changed', (event, isSettingsOpen) => {
      callback(isSettingsOpen);
    });
  }
});

contextBridge.exposeInMainWorld('auth', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getState: () => ipcRenderer.invoke('auth:getState'),
  getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
  getUserInfo: () => ipcRenderer.invoke('auth:getUserInfo'),
  getProfilePhoto: () => ipcRenderer.invoke('auth:getProfilePhoto'),
  onStateChanged: (callback) => {
    ipcRenderer.on('auth:state-changed', (event, state) => {
      callback(state);
    });
  }
});

contextBridge.exposeInMainWorld('app', {
  quit: () => ipcRenderer.invoke('app:quit'),
  log: (level, ...args) => ipcRenderer.send('app:log', level, ...args)
});

contextBridge.exposeInMainWorld('calendar', {
  getEvents: () => ipcRenderer.invoke('calendar:getEvents'),
  getNextEvent: () => ipcRenderer.invoke('calendar:getNextEvent'),
  getEventsByDay: () => ipcRenderer.invoke('calendar:getEventsByDay'),
  getUserPhoto: (email) => ipcRenderer.invoke('calendar:getUserPhoto', email),
  onEventsUpdated: (callback) => {
    ipcRenderer.on('calendar:events-updated', (event, events) => {
      callback(events);
    });
  }
});

