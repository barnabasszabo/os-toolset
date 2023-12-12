import { app, BrowserWindow, screen, ipcMain, Tray } from 'electron';
import * as path from 'path';
import * as url from 'url';

let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');
let tray = undefined;

app.dock.hide();
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');

function createWindow(): BrowserWindow {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    // x: 0,
    // y: 0,
    // width: size.width,
    // height: size.height,
    width: 1024,
    height: 800,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: true,
    transparent: false,
    webPreferences: {
      backgroundThrottling: false,
      webSecurity: false,
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      contextIsolation: false,  // false if you want to run 2e2 test with Spectron
      enableRemoteModule : true, // true if you want to run 2e2 test  with Spectron or use remote module in renderer context (ie. Angular)
      disableBlinkFeatures: `OutOfBlinkCors`
    },
  });

  if (serve) {

    win.webContents.openDevTools();

    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');

  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  // Hide the window when it loses focus
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })

  return win;
}

const createTray = () => {
  tray = new Tray( path.join(__dirname, 'tray-icon.png') );
  tray.on('click', function (event) {
    toggleWindow();
  });
}

const getWindowPosition = () => {
  const windowBounds = win.getBounds();
  const trayBounds = tray.getBounds();

  // Center window horizontally below the tray icon
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));

  // Position window 4 pixels vertically below the tray icon
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  return {x: x, y: y};
}

const toggleWindow = () => {
  win.isVisible() ? win.hide() : showWindow();
}

const onWindowShowSubscribers = [];
const showWindow = () => {
  const position = getWindowPosition();
  win.setPosition(position.x, position.y, false);
  win.show();

  const subscribers = onWindowShowSubscribers.filter(s => s);
  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    sub.send('onWindowShow', 'show');
  }
}
ipcMain.on('onWindowShowSubscription', (event, args) => {
  onWindowShowSubscribers.push(event.sender);
});

ipcMain.on('show-window', () => {
  showWindow()
})

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400);
    setTimeout(createTray, 500);
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
