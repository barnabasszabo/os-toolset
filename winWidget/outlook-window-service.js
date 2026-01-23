const { BrowserWindow, screen } = require('electron');

const OUTLOOK_URL = 'https://outlook.office365.com/calendar/view/workweek';

const WINDOW_SIZE = { width: 1200, height: 800 };
const WINDOW_OFFSET = 12;

let outlookWindow = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getAnchoredBounds(anchorBounds) {
  const display = screen.getDisplayNearestPoint({
    x: anchorBounds.x,
    y: anchorBounds.y
  });
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const width = WINDOW_SIZE.width;
  const height = WINDOW_SIZE.height;

  let x = anchorBounds.x + anchorBounds.width - width;
  let y = anchorBounds.y - height - WINDOW_OFFSET;

  if (y < dy) {
    y = anchorBounds.y + anchorBounds.height + WINDOW_OFFSET;
  }

  x = clamp(x, dx, dx + dw - width);
  y = clamp(y, dy, dy + dh - height);

  return { x, y, width, height };
}

function createOutlookWindow(anchorBounds) {
  const bounds = getAnchoredBounds(anchorBounds);
  outlookWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#111827',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  outlookWindow.loadURL(OUTLOOK_URL);
  outlookWindow.on('blur', () => {
    if (outlookWindow && !outlookWindow.isDestroyed()) {
      outlookWindow.hide();
    }
  });
  outlookWindow.on('closed', () => {
    outlookWindow = null;
  });
}

function openOutlookCalendarWindow(anchorBounds) {
  if (!anchorBounds) return;
  if (!outlookWindow) {
    createOutlookWindow(anchorBounds);
  } else {
    const bounds = getAnchoredBounds(anchorBounds);
    outlookWindow.setBounds(bounds);
  }
  outlookWindow.show();
  outlookWindow.focus();
}

module.exports = {
  openOutlookCalendarWindow
};
