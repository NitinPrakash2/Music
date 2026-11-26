const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const logFile = path.join(os.tmpdir(), 'relaxify-boot.log');
const log = (msg) => {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
};

const isPackaged = app.isPackaged;
const resourcesRoot = isPackaged ? process.resourcesPath : path.join(__dirname, '..');

// Point server to bundled .env and standalone yt-dlp.exe
const packagedEnv = path.join(resourcesRoot, '.env');
const devEnv = path.join(__dirname, '..', 'server', '.env');
process.env.ENV_PATH = fs.existsSync(packagedEnv) ? packagedEnv : devEnv;

const packagedYtDlp = path.join(resourcesRoot, 'bin', 'yt-dlp.exe');
const devYtDlp = path.join(__dirname, 'bin', 'yt-dlp.exe');
process.env.YTDLP_PATH = fs.existsSync(packagedYtDlp) ? packagedYtDlp : devYtDlp;

let mainWindow = null;
let httpServer = null;

async function createWindow() {
  try {
    log(`ENV_PATH=${process.env.ENV_PATH} exists=${fs.existsSync(process.env.ENV_PATH)}`);
    log(`YTDLP_PATH=${process.env.YTDLP_PATH} exists=${fs.existsSync(process.env.YTDLP_PATH)}`);
    const { startServer } = require('../server/server');
    const staticDir = isPackaged
      ? path.join(process.resourcesPath, 'client-dist')
      : path.join(__dirname, '..', 'client', 'dist');
    log(`staticDir=${staticDir} exists=${fs.existsSync(staticDir)}`);

    const { server, port } = await startServer({ port: 54321, staticDir });
    httpServer = server;
    log(`Server listening on port ${port}`);

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      title: 'Relaxify',
      backgroundColor: '#08080a',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    mainWindow.loadURL(`http://127.0.0.1:${port}`);
    mainWindow.webContents.on('did-finish-load', () => {
      log('did-finish-load');
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        try {
          const len = await mainWindow.webContents.executeJavaScript('document.getElementById("root")?.innerHTML?.length || 0');
          log(`root innerHTML length=${len}`);
          if (len === 0) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
          }
        } catch {}
      }, 2500);
    });
    mainWindow.webContents.on('console-message', (_e, level, msg) => log(`renderer[${level}]: ${msg}`));
    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      log(`did-fail-load ${code} ${desc}`);
      dialog.showErrorBox('Relaxify Load Error', `Failed to load (${code}): ${desc}`);
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    log(`FATAL: ${err.stack || err.message}`);
    dialog.showErrorBox('Relaxify Startup Error', err.stack || err.message);
    app.quit();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  if (process.platform !== 'darwin') app.quit();
});
