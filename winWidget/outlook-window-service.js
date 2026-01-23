const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow
} = require('./window-utils');

const OUTLOOK_URL = 'https://outlook.office365.com/calendar/view/workweek';
const WINDOW_SIZE = { width: 1500, height: 950 };
const WINDOW_OFFSET = 12;

let outlookWindow = null;

function getOutlookBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, WINDOW_SIZE, WINDOW_OFFSET);
}

function buildOutlookWindow(anchorBounds) {
  const bounds = getOutlookBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  outlookWindow = createFloatingWindow(bounds, webPreferences);
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
