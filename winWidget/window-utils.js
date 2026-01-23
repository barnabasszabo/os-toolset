const { BrowserWindow, screen } = require('electron');

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getWorkArea(anchorBounds) {
  const display = screen.getDisplayNearestPoint({
    x: anchorBounds.x,
    y: anchorBounds.y
  });
  return display.workArea;
}

function adjustVerticalPosition(anchorBounds, height, offset, workArea) {
  const above = anchorBounds.y - height - offset;
  if (above >= workArea.y) return above;
  return anchorBounds.y + anchorBounds.height + offset;
}

function getAnchoredBounds(anchorBounds, size, offset) {
  const workArea = getWorkArea(anchorBounds);
  const width = size.width;
  const height = size.height;
  const rawX = anchorBounds.x + anchorBounds.width - width;
  const rawY = adjustVerticalPosition(anchorBounds, height, offset, workArea);
  const x = clampValue(rawX, workArea.x, workArea.x + workArea.width - width);
  const y = clampValue(rawY, workArea.y, workArea.y + workArea.height - height);
  return { x, y, width, height };
}

function createFloatingWindow(bounds, webPreferences) {
  return new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#111827',
    webPreferences
  });
}

function attachAutoHideHandlers(windowRef, onClosed) {
  windowRef.on('blur', () => {
    if (!windowRef.isDestroyed()) {
      windowRef.hide();
    }
  });
  windowRef.on('closed', onClosed);
}

function showWindow(windowRef) {
  if (!windowRef || windowRef.isDestroyed()) return;
  windowRef.show();
  windowRef.focus();
}

module.exports = {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow
};
