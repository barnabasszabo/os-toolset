const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_WIDTH = 1500;
const DEFAULT_HEIGHT = 950;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

const STORAGE_FILE = 'webview-window-sizes.json';

const KEY_OUTLOOK = 'outlookWebview';
const KEY_TIMEWEB = 'timeWebview';
const KEY_JIRA = 'jiraWebview';

function preferencesPath() {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

function readSizes() {
  try {
    const p = preferencesPath();
    if (!fs.existsSync(p)) return {};
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof data === 'object' && data !== null ? data : {};
  } catch (e) {
    return {};
  }
}

function writeSizes(sizes) {
  try {
    fs.writeFileSync(preferencesPath(), JSON.stringify(sizes), 'utf8');
  } catch (e) {
    console.error('[webview-window-preferences] write failed', e.message);
  }
}

function normalizeDim(value, fallback, minVal) {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.max(minVal, Math.round(value));
}

function loadSize(key) {
  const sizes = readSizes();
  const entry = sizes[key];
  return {
    width: normalizeDim(entry?.width, DEFAULT_WIDTH, MIN_WIDTH),
    height: normalizeDim(entry?.height, DEFAULT_HEIGHT, MIN_HEIGHT)
  };
}

function saveSize(key, width, height) {
  const sizes = readSizes();
  sizes[key] = {
    width: normalizeDim(width, DEFAULT_WIDTH, MIN_WIDTH),
    height: normalizeDim(height, DEFAULT_HEIGHT, MIN_HEIGHT)
  };
  writeSizes(sizes);
}

module.exports = {
  KEY_OUTLOOK,
  KEY_TIMEWEB,
  KEY_JIRA,
  loadSize,
  saveSize
};
