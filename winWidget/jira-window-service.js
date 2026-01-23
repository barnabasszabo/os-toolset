const {
  getAnchoredBounds,
  createFloatingWindow,
  attachAutoHideHandlers,
  showWindow
} = require('./window-utils');

const JIRA_CLOCKWORK_URL = 'https://trendency.atlassian.net/plugins/servlet/ac/clockwork-cloud/clockwork-mywork';
const WINDOW_SIZE = { width: 1500, height: 950 };
const WINDOW_OFFSET = 12;

let jiraClockworkWindow = null;

function getJiraClockworkBounds(anchorBounds) {
  return getAnchoredBounds(anchorBounds, WINDOW_SIZE, WINDOW_OFFSET);
}

function buildJiraClockworkWindow(anchorBounds) {
  const bounds = getJiraClockworkBounds(anchorBounds);
  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };
  jiraClockworkWindow = createFloatingWindow(bounds, webPreferences);
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
