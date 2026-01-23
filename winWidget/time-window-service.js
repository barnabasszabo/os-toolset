const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow
} = require('./window-utils');

const TIME_WEB_URL = 'http://localhost:8070/';
const WINDOW_SIZE = { width: 1500, height: 950 };
const WINDOW_OFFSET = 12;

let timeWebWindow = null;

function getTimeWebBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, WINDOW_SIZE, WINDOW_OFFSET);
}

function buildTimeWebWindow(anchorBounds) {
  const bounds = getTimeWebBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  timeWebWindow = createFloatingWindow(bounds, webPreferences);
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
