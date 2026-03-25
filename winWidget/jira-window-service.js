const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow,
  attachWebviewSizePersistence
} = require('./window-utils');
const prefs = require('./webview-window-preferences');

const JIRA_CLOCKWORK_URL =
  'https://trendency.atlassian.net/plugins/servlet/ac/clockwork-cloud/clockwork-mywork';
const WINDOW_OFFSET = 12;

let jiraClockworkWindow = null;

function getJiraClockworkBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, prefs.loadSize(prefs.KEY_JIRA), WINDOW_OFFSET);
}

function buildJiraClockworkWindow(anchorBounds) {
  const bounds = getJiraClockworkBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  jiraClockworkWindow = createFloatingWindow(bounds, webPreferences);
  attachWebviewSizePersistence(jiraClockworkWindow, (w, h) => {
    prefs.saveSize(prefs.KEY_JIRA, w, h);
  });
  jiraClockworkWindow.loadURL(JIRA_CLOCKWORK_URL);
  attachAutoHideHandlers(jiraClockworkWindow, () => {
    jiraClockworkWindow = null;
  });
}

function updateJiraClockworkWindow(anchorBounds) {
  const bounds = getJiraClockworkBounds(anchorBounds);
  jiraClockworkWindow.setBounds(bounds);
}

function openJiraClockworkWindow(anchorBounds) {
  if (!anchorBounds) return;
  if (!jiraClockworkWindow) {
    buildJiraClockworkWindow(anchorBounds);
  } else {
    updateJiraClockworkWindow(anchorBounds);
  }
  showWindow(jiraClockworkWindow);
}

module.exports = { openJiraClockworkWindow };
