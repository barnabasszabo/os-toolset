const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const authService = require('./auth-service');
const calendarService = require('./calendar-service');

// Enable hot reload in development
let reloader;
const isDevelopment = process.env.NODE_ENV !== 'production' || !app.isPackaged;

if (isDevelopment) {
  try {
    reloader = require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true,
      ignore: ['widget-position.json', 'auth-state.json', 'msal-cache.json']
    });
    console.log('Hot reload enabled');
  } catch (err) {
    // electron-reloader only works in development
    console.log('Hot reload not available:', err.message);
  }
}

let mainWindow = null;
let isExpanded = false;
let isSettingsOpen = false;
let savedPosition = null;

const COLLAPSED_WIDTH = 480;
const COLLAPSED_HEIGHT = 50;
const EXPANDED_WIDTH = 480;
const EXPANDED_HEIGHT = 600;

const POSITION_FILE = path.join(app.getPath('userData'), 'widget-position.json');

function getCursorPoint() {
  const point = screen.getCursorScreenPoint();
  return point;
}

function loadSavedPosition() {
  try {
    if (fs.existsSync(POSITION_FILE)) {
      const data = fs.readFileSync(POSITION_FILE, 'utf8');
      savedPosition = JSON.parse(data);
      // Validate position is still on a valid display
      if (savedPosition && savedPosition.x !== undefined && savedPosition.y !== undefined) {
        const displays = screen.getAllDisplays();
        const isValid = displays.some(display => {
          const bounds = display.bounds;
          return savedPosition.x >= bounds.x && 
                 savedPosition.x < bounds.x + bounds.width &&
                 savedPosition.y >= bounds.y && 
                 savedPosition.y < bounds.y + bounds.height;
        });
        if (isValid) {
          return savedPosition;
        }
      }
    }
  } catch (error) {
    console.error('Error loading saved position:', error);
  }
  return null;
}

function savePosition(x, y) {
  try {
    savedPosition = { x, y };
    fs.writeFileSync(POSITION_FILE, JSON.stringify(savedPosition), 'utf8');
  } catch (error) {
    console.error('Error saving position:', error);
  }
}

function positionWindow(window, useSavedPosition = true) {
  if (!window) return;
  
  const currentHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
  const currentWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  
  let x, y;
  
  if (useSavedPosition && savedPosition) {
    // Use saved position, but adjust Y to maintain bottom alignment with new height
    const display = screen.getDisplayNearestPoint(savedPosition);
    const bounds = display.bounds;
    
    // Calculate relative position from bottom
    const oldHeight = isExpanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
    const relativeY = savedPosition.y - (bounds.y + bounds.height - oldHeight);
    
    x = savedPosition.x;
    y = bounds.y + bounds.height - currentHeight + relativeY;
    
    // Ensure window stays within display bounds (can overlap taskbar)
    if (y < bounds.y) y = bounds.y;
    if (y + currentHeight > bounds.y + bounds.height) {
      y = bounds.y + bounds.height - currentHeight;
    }
    if (x < bounds.x) x = bounds.x;
    if (x + currentWidth > bounds.x + bounds.width) {
      x = bounds.x + bounds.width - currentWidth;
    }
  } else {
    // Default position: bottom left (can overlap taskbar)
    const cursorPoint = getCursorPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const bounds = display.bounds;
    
    x = bounds.x;
    y = bounds.y + bounds.height - currentHeight;
  }
  
  window.setBounds({
    x: x,
    y: y,
    width: currentWidth,
    height: currentHeight
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: false,
    backgroundColor: '#212529',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Forward renderer console logs to main process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });
  
  // IPC handler for renderer logs
  ipcMain.on('app:log', (event, level, ...args) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    console.log(`[Renderer] ${message}`);
  });
  
  // Show without stealing focus
  mainWindow.showInactive();
  
  // Load saved position
  savedPosition = loadSavedPosition();
  
  // Initial positioning
  positionWindow(mainWindow, true);
  
  // Windows: always on top, screen-saver level (highest). Apply after show+position.
  // Reinforce on blur and periodically, so taskbar/Start menu don’t push us behind.
  if (process.platform === 'win32') {
    const reinforceAlwaysOnTop = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
    };
    reinforceAlwaysOnTop();
    mainWindow.on('blur', reinforceAlwaysOnTop);
    const alwaysOnTopInterval = setInterval(reinforceAlwaysOnTop, 1500);
    mainWindow.on('closed', () => {
      clearInterval(alwaysOnTopInterval);
      mainWindow = null;
    });
  }
  
  // Save position when window is moved
  mainWindow.on('moved', () => {
    const bounds = mainWindow.getBounds();
    savePosition(bounds.x, bounds.y);
  });
  
  // Handle display changes - reposition if needed
  screen.on('display-added', () => {
    // Validate saved position is still valid
    if (savedPosition) {
      const displays = screen.getAllDisplays();
      const isValid = displays.some(display => {
        const bounds = display.bounds;
        return savedPosition.x >= bounds.x && 
               savedPosition.x < bounds.x + bounds.width &&
               savedPosition.y >= bounds.y && 
               savedPosition.y < bounds.y + bounds.height;
      });
      if (!isValid) {
        savedPosition = null;
      }
    }
    positionWindow(mainWindow, true);
  });
  
  screen.on('display-removed', () => {
    // Validate saved position is still valid
    if (savedPosition) {
      const displays = screen.getAllDisplays();
      const isValid = displays.some(display => {
        const bounds = display.bounds;
        return savedPosition.x >= bounds.x && 
               savedPosition.x < bounds.x + bounds.width &&
               savedPosition.y >= bounds.y && 
               savedPosition.y < bounds.y + bounds.height;
      });
      if (!isValid) {
        savedPosition = null;
      }
    }
    positionWindow(mainWindow, true);
  });
  
  screen.on('display-metrics-changed', () => {
    positionWindow(mainWindow, true);
  });
}

// IPC handlers
ipcMain.handle('widget:toggle', () => {
  if (!mainWindow) return isExpanded;
  
  // Prevent rapid toggling
  if (mainWindow.isUpdating) return isExpanded;
  mainWindow.isUpdating = true;
  
  isExpanded = !isExpanded;
  
  const newHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
  const newWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
  
  // Get current position and maintain it, adjusting only height
  const currentBounds = mainWindow.getBounds();
  const oldHeight = isExpanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
  
  // Calculate new Y position to keep bottom edge in same place
  const newY = currentBounds.y + oldHeight - newHeight;
  
  // Ensure window stays within current display bounds
  const display = screen.getDisplayNearestPoint({ x: currentBounds.x, y: currentBounds.y });
  const bounds = display.bounds;
  
  let finalY = newY;
  if (finalY < bounds.y) finalY = bounds.y;
  if (finalY + newHeight > bounds.y + bounds.height) {
    finalY = bounds.y + bounds.height - newHeight;
  }
  
  mainWindow.setBounds({
    x: currentBounds.x,
    y: finalY,
    width: newWidth,
    height: newHeight
  });
  
  // Update saved position
  savePosition(currentBounds.x, finalY);
  
  // Notify renderer of state change after a small delay
  setTimeout(() => {
    mainWindow.webContents.send('widget:state-changed', isExpanded);
    mainWindow.isUpdating = false;
  }, 50);
  
  return isExpanded;
});

ipcMain.handle('widget:getState', () => {
  return isExpanded;
});

ipcMain.handle('widget:toggleSettings', () => {
  isSettingsOpen = !isSettingsOpen;
  if (mainWindow) {
    mainWindow.webContents.send('widget:settings-state-changed', isSettingsOpen);
  }
  return isSettingsOpen;
});

ipcMain.handle('widget:getSettingsState', () => {
  return isSettingsOpen;
});

// Auth IPC handlers
ipcMain.handle('auth:login', async () => {
  try {
    await authService.ensureInitialized();
    const result = await authService.login();
    if (result.success && mainWindow) {
      // Get user info after successful login
      const userInfo = await authService.getUserInfo();
      mainWindow.webContents.send('auth:state-changed', {
        isAuthenticated: true,
        account: result.account,
        userInfo: userInfo,
      });
    }
    return result;
  } catch (error) {
    console.error('Login IPC error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  try {
    await authService.ensureInitialized();
    const result = await authService.logout();
    if (result.success && mainWindow) {
      mainWindow.webContents.send('auth:state-changed', {
        isAuthenticated: false,
        account: null,
        userInfo: null,
      });
    }
    return result;
  } catch (error) {
    console.error('Logout IPC error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:getState', async () => {
  try {
    // Ensure auth service is initialized before getting state
    await authService.ensureInitialized();
    const account = authService.getAccount();
    const userInfo = authService.isAuthenticated() ? await authService.getUserInfo() : null;
    return {
      isAuthenticated: authService.isAuthenticated(),
      account: account,
      userInfo: userInfo,
    };
  } catch (error) {
    console.error('Get auth state error:', error);
    return {
      isAuthenticated: false,
      account: null,
      userInfo: null,
    };
  }
});

ipcMain.handle('auth:getAccessToken', async () => {
  try {
    const token = await authService.getAccessToken();
    return { success: !!token, token: token };
  } catch (error) {
    console.error('Get access token error:', error);
    return { success: false, token: null };
  }
});

ipcMain.handle('auth:getUserInfo', async () => {
  try {
    const userInfo = await authService.getUserInfo();
    return { success: !!userInfo, userInfo: userInfo };
  } catch (error) {
    console.error('Get user info error:', error);
    return { success: false, userInfo: null };
  }
});

ipcMain.handle('auth:getProfilePhoto', async () => {
  try {
    return await authService.getProfilePhoto();
  } catch (error) {
    console.error('Get profile photo error:', error);
    return null;
  }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

// Calendar IPC handlers
ipcMain.handle('calendar:getEvents', async () => {
  try {
    await authService.ensureInitialized();
    return await calendarService.getCalendarEvents();
  } catch (error) {
    console.error('Get calendar events error:', error);
    return [];
  }
});

ipcMain.handle('calendar:getNextEvent', async () => {
  await authService.ensureInitialized();
  return calendarService.getNextEvent();
});

ipcMain.handle('calendar:getEventsByDay', async () => {
  await authService.ensureInitialized();
  return calendarService.getEventsByDay();
});

ipcMain.handle('calendar:getUserPhoto', async (event, email) => {
  try {
    const token = await authService.getAccessToken();
    if (!token) return null;
    
    // Microsoft Graph API: get user photo by email
    const url = new URL(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    return await new Promise((resolve) => {
      const req = https.request(options, (res) => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const contentType = res.headers['content-type'] || 'image/jpeg';
            const b64 = Buffer.concat(chunks).toString('base64');
            resolve(`data:${contentType};base64,${b64}`);
          } else {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.end();
    });
  } catch (error) {
    console.error('Get user photo error:', error);
    return null;
  }
});

app.whenReady().then(async () => {
  // Set up callback for auth state restoration
  authService.setStateRestoredCallback((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:state-changed', state);
    }
  });
  
  // Ensure auth is initialized before creating window
  await authService.ensureInitialized();
  
  createWindow();
  
  // Start calendar auto-refresh
  calendarService.startAutoRefresh((events) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('calendar:events-updated', events);
    }
  }, 1); // 1 perc
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Hot reload módban ne lépjen ki automatikusan
  if (reloader) {
    // electron-reloader kezeli az újraindítást
    return;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Biztosítjuk, hogy az app kilépjen, amikor a process kilép (csak ha nincs hot reload)
if (!reloader) {
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, quitting...');
    app.quit();
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, quitting...');
    app.quit();
  });
}
