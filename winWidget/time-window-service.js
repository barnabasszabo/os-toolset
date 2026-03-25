const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow,
  attachWebviewSizePersistence
} = require('./window-utils');
const prefs = require('./webview-window-preferences');

const TIME_WEB_URL = 'http://localhost:8070/';
const WINDOW_OFFSET = 12;

let timeWebWindow = null;

function getTimeWebBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, prefs.loadSize(prefs.KEY_TIMEWEB), WINDOW_OFFSET);
}

function buildTimeWebWindow(anchorBounds) {
  const bounds = getTimeWebBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  timeWebWindow = createFloatingWindow(bounds, webPreferences);
  attachWebviewSizePersistence(timeWebWindow, (w, h) => {
    prefs.saveSize(prefs.KEY_TIMEWEB, w, h);
  });
  timeWebWindow.loadURL(TIME_WEB_URL);
  attachAutoHideHandlers(timeWebWindow, () => {
    timeWebWindow = null;
  });
}

function updateTimeWebWindow(anchorBounds) {
  const bounds = getTimeWebBounds(anchorBounds);
  timeWebWindow.setBounds(bounds);
}

function openTimeWebWindow(anchorBounds) {
  if (!anchorBounds) return;
  if (!timeWebWindow) {
    buildTimeWebWindow(anchorBounds);
  } else {
    updateTimeWebWindow(anchorBounds);
  }
  showWindow(timeWebWindow);
}

module.exports = { openTimeWebWindow };
