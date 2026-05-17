const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ANIMALS = [
  { id: 'blue_cat', label: 'Iñi the Cat' },
  { id: 'cat', label: 'Juani the Cat' }
];

const DEFAULT_CONFIG = {
  breakMinutes: 5,
  animal: 'blue_cat',
  apps: [
    {
      processName: 'Google Chrome',
      timeLimitMinutes: 45,
      description: 'Browser time limit'
    },
    {
      processName: 'Safari',
      timeLimitMinutes: 45,
      description: 'Browser time limit'
    },
    {
      processName: 'Code',
      timeLimitMinutes: 120,
      description: 'Time to stretch after coding'
    }
  ]
};

let mainWindow = null;
let overlayWindow = null;
let config = DEFAULT_CONFIG;
let tracking = false;
let activeApp = 'unknown';
let usageSeconds = {};
let polling = false;
let pollTimer = null;
let isQuitting = false;
let lastActiveError = '';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function safeInt(value, fallback, minimum = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function normalizeApp(item) {
  if (!item || typeof item !== 'object') return null;
  const processName = String(item.processName || item.process_name || '').trim();
  if (!processName) return null;

  return {
    processName,
    timeLimitMinutes: safeInt(
      item.timeLimitMinutes || item.time_limit_minutes,
      30,
      0
    ),
    description: String(item.description || '').trim()
  };
}

function normalizeConfig(raw) {
  const animalIds = ANIMALS.map((animal) => animal.id);
  const animal = animalIds.includes(raw && raw.animal) ? raw.animal : DEFAULT_CONFIG.animal;
  const rawApps = Array.isArray(raw && raw.apps) ? raw.apps : DEFAULT_CONFIG.apps;
  const apps = rawApps.map(normalizeApp).filter(Boolean);

  return {
    breakMinutes: safeInt(
      raw && (raw.breakMinutes || raw.global_rest_time_minutes),
      DEFAULT_CONFIG.breakMinutes,
      0
    ),
    animal,
    apps
  };
}

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    config = normalizeConfig(JSON.parse(fs.readFileSync(configPath(), 'utf8')));
  } catch (_error) {
    config = normalizeConfig(DEFAULT_CONFIG);
    saveConfig(config);
  }
}

function saveConfig(nextConfig) {
  config = normalizeConfig(nextConfig);
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('state', {
    activeApp,
    config,
    tracking,
    resting: Boolean(overlayWindow),
    usageSeconds
  });
}

function log(line) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('log', line);
}

function detectActiveApp() {
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/osascript',
      ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true'],
      { timeout: 2500 },
      (error, stdout) => {
        const name = String(stdout || '').trim();
        resolve({
          name: name || 'unknown',
          error: error ? String(error.message || error) : ''
        });
      }
    );
  });
}

function findLimitSeconds(processName) {
  const entry = config.apps.find((item) => item.processName === processName);
  if (!entry) return null;
  return Math.max(0, entry.timeLimitMinutes * 60);
}

function finishOverlay(processName) {
  overlayWindow = null;

  if (processName) {
    usageSeconds[processName] = 0;
    if (!isQuitting) {
      tracking = true;
      log(`Break complete: ${processName}`);
    }
  }

  sendState();
}

function showOverlay(seconds, animal, processName = '') {
  if (overlayWindow) return;

  const display = screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const selectedAnimal = ANIMALS.some((item) => item.id === animal) ? animal : DEFAULT_CONFIG.animal;
  const duration = Math.max(0, Math.floor(seconds));

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'), {
    query: { seconds: String(duration), animal: selectedAnimal }
  });

  const currentWindow = overlayWindow;
  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    if (overlayWindow === currentWindow) finishOverlay(processName);
  };

  overlayWindow.on('closed', finishOnce);
  setTimeout(() => {
    if (currentWindow && !currentWindow.isDestroyed()) currentWindow.close();
  }, Math.max(750, (duration * 1000) + 700));
}

async function pollActiveApp() {
  if (polling) return;
  polling = true;

  try {
    const result = await detectActiveApp();
    activeApp = result.name;

    if (result.error && result.error !== lastActiveError) {
      lastActiveError = result.error;
      log('macOS denied active-app detection. Enable Accessibility for Cat Gatekeeper if tracking stays unknown.');
    }

    if (tracking && !overlayWindow) {
      const limit = findLimitSeconds(activeApp);
      if (limit !== null) {
        usageSeconds[activeApp] = (usageSeconds[activeApp] || 0) + 1;
        if (usageSeconds[activeApp] >= limit) {
          tracking = false;
          log(`Limit reached: ${activeApp}`);
          showOverlay(config.breakMinutes * 60, config.animal, activeApp);
        }
      }
    }
  } finally {
    polling = false;
    sendState();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 620,
    minWidth: 760,
    minHeight: 520,
    title: 'Cat Gatekeeper',
    backgroundColor: '#f4f2ed',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-initial', () => ({
  animals: ANIMALS,
  config,
  state: {
    activeApp,
    config,
    tracking,
    resting: Boolean(overlayWindow),
    usageSeconds
  }
}));

ipcMain.handle('save-config', (_event, nextConfig) => {
  const saved = saveConfig(nextConfig);
  sendState();
  return saved;
});

ipcMain.handle('start-tracking', () => {
  tracking = true;
  log('Tracking started.');
  sendState();
});

ipcMain.handle('stop-tracking', () => {
  tracking = false;
  log('Tracking stopped.');
  sendState();
});

ipcMain.handle('reset-timers', () => {
  usageSeconds = {};
  log('Timers reset.');
  sendState();
});

ipcMain.handle('test-overlay', (_event, animal) => {
  showOverlay(8, animal || config.animal);
});

ipcMain.handle('get-active', async () => detectActiveApp());

app.whenReady().then(() => {
  loadConfig();
  createMainWindow();
  pollTimer = setInterval(pollActiveApp, 1000);
  pollActiveApp();

  const smokeMode = process.env.CAT_GATEKEEPER_GIFT_SMOKE;
  if (smokeMode === 'ui') {
    setTimeout(() => app.quit(), 1800);
  }
  if (smokeMode === 'overlay') {
    showOverlay(2, process.env.CAT_GATEKEEPER_GIFT_SMOKE_ANIMAL || 'blue_cat');
    setTimeout(() => app.quit(), 3600);
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
