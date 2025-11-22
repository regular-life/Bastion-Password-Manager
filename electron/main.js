const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let masterKey = null;

// Native messaging host info
const NATIVE_HOST_NAME = 'com.bastion.native';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, 'frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clear master key from memory on window close
    if (masterKey) {
      masterKey.fill(0);
      masterKey = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupNativeMessaging();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for master key management
ipcMain.handle('set-master-key', (event, key) => {
  masterKey = Buffer.from(key);
  return true;
});

ipcMain.handle('get-master-key', () => {
  if (!masterKey) {
    return null;
  }
  return Array.from(masterKey);
});

ipcMain.handle('clear-master-key', () => {
  if (masterKey) {
    masterKey.fill(0);
    masterKey = null;
  }
  return true;
});

// Dialog handler
ipcMain.handle('show-confirm-dialog', async (event, message) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Yes', 'No'],
    defaultId: 0,
    title: 'Bastion',
    message: 'Bastion',
    detail: message,
  });
  return result.response === 0;
});

// Native messaging setup
function setupNativeMessaging() {
  // Create native messaging host manifest
  const hostManifest = {
    name: NATIVE_HOST_NAME,
    description: 'Bastion Native Messaging Host',
    path: process.execPath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://EXTENSION_ID_HERE/',
    ],
  };

  // Install manifest files for Chrome/Edge
  if (process.platform === 'darwin') {
    const chromeDir = path.join(
      process.env.HOME,
      'Library/Application Support/Google/Chrome/NativeMessagingHosts'
    );
    const edgeDir = path.join(
      process.env.HOME,
      'Library/Application Support/Microsoft Edge/NativeMessagingHosts'
    );

    [chromeDir, edgeDir].forEach((dir) => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(dir, `${NATIVE_HOST_NAME}.json`),
          JSON.stringify(hostManifest, null, 2)
        );
      } catch (err) {
        console.error('Failed to create native messaging manifest:', err);
      }
    });
  }
}

// Native messaging handler (stdio)
if (process.argv.includes('--native-messaging')) {
  handleNativeMessaging();
}

function handleNativeMessaging() {
  process.stdin.on('data', (data) => {
    try {
      const messageLength = data.readUInt32LE(0);
      const messageData = data.slice(4, 4 + messageLength);
      const message = JSON.parse(messageData.toString());

      handleNativeMessage(message, (response) => {
        sendNativeMessage(response);
      });
    } catch (err) {
      console.error('Native messaging error:', err);
    }
  });
}

function handleNativeMessage(message, callback) {
  switch (message.type) {
    case 'get-master-key':
      if (masterKey) {
        callback({
          type: 'master-key',
          key: Array.from(masterKey),
        });
      } else {
        callback({
          type: 'error',
          error: 'Master key not available',
        });
      }
      break;

    case 'ping':
      callback({ type: 'pong' });
      break;

    default:
      callback({
        type: 'error',
        error: 'Unknown message type',
      });
  }
}

function sendNativeMessage(message) {
  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr);
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);
}
