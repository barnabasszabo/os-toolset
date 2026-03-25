const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow,
  attachWebviewSizePersistence
} = require('./window-utils');
const prefs = require('./webview-window-preferences');

const OUTLOOK_URL = 'https://outlook.office365.com/calendar/view/workweek';
const WINDOW_OFFSET = 12;

let outlookWindow = null;

function getOutlookBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, prefs.loadSize(prefs.KEY_OUTLOOK), WINDOW_OFFSET);
}

function buildOutlookWindow(anchorBounds) {
  const bounds = getOutlookBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  outlookWindow = createFloatingWindow(bounds, webPreferences);
  attachWebviewSizePersistence(outlookWindow, (w, h) => {
    prefs.saveSize(prefs.KEY_OUTLOOK, w, h);
  });
  outlookWindow.loadURL(OUTLOOK_URL);
  attachAutoHideHandlers(outlookWindow, () => {
    outlookWindow = null;
  });
}

function updateOutlookWindow(anchorBounds) {
  const bounds = getOutlookBounds(anchorBounds);
  outlookWindow.setBounds(bounds);
}

function openOutlookCalendarWindow(anchorBounds) {
  if (!anchorBounds) return;
  if (!outlookWindow) {
    buildOutlookWindow(anchorBounds);
  } else {
    updateOutlookWindow(anchorBounds);
  }
  showWindow(outlookWindow);
}

module.exports = { openOutlookCalendarWindow };
