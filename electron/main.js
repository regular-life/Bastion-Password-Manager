const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Load native crypto addon
const bastionCrypto = require('./native-crypto/index.js');

let mainWindow;

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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    bastionCrypto.clearMasterKey();
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

// IPC handlers for crypto
ipcMain.on('crypto:deriveMasterKey', (event, password, salt) => {
  event.returnValue = bastionCrypto.deriveMasterKey(password, salt);
});
ipcMain.on('crypto:clearMasterKey', (event) => {
  event.returnValue = bastionCrypto.clearMasterKey();
});
ipcMain.on('crypto:generateKey', (event) => {
  event.returnValue = bastionCrypto.generateKey();
});
ipcMain.on('crypto:destroyKey', (event, keyHandle) => {
  event.returnValue = bastionCrypto.destroyKey(keyHandle);
});
ipcMain.on('crypto:encrypt', (event, plaintext, keyHandle) => {
  try {
    event.returnValue = bastionCrypto.encrypt(plaintext, keyHandle);
  } catch (e) {
    event.returnValue = { error: e.message };
  }
});
ipcMain.on('crypto:decrypt', (event, ciphertext, nonce, keyHandle, returnAsHandle) => {
  try {
    event.returnValue = bastionCrypto.decrypt(ciphertext, nonce, keyHandle, returnAsHandle);
  } catch (e) {
    event.returnValue = { error: e.message };
  }
});
ipcMain.on('crypto:generateKeyPair', (event) => {
  try {
    event.returnValue = bastionCrypto.generateKeyPair();
  } catch (e) { event.returnValue = { error: e.message }; }
});
ipcMain.on('crypto:encryptForPublicKey', (event, plaintext, pk) => {
  try {
    event.returnValue = bastionCrypto.encryptForPublicKey(plaintext, pk);
  } catch (e) { event.returnValue = { error: e.message }; }
});
ipcMain.on('crypto:decryptWithPrivateKey', (event, ciphertext, pk, sk) => {
  try {
    event.returnValue = bastionCrypto.decryptWithPrivateKey(ciphertext, pk, sk);
  } catch (e) { event.returnValue = { error: e.message }; }
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
  const hostManifest = {
    name: NATIVE_HOST_NAME,
    description: 'Bastion Native Messaging Host',
    path: process.execPath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://EXTENSION_ID_HERE/',
    ],
  };

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
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function urlMatches(currentUrl, savedUrl) {
  try {
    const current = new URL(currentUrl);
    const saved = new URL(savedUrl);
    return current.hostname === saved.hostname ||
           current.hostname.endsWith('.' + saved.hostname) ||
           saved.hostname.endsWith('.' + current.hostname);
  } catch (err) { return false; }
}

function handleNativeMessage(message, callback) {
  switch (message.type) {
    case 'get-credentials':
      try {
        const matches = [];
        for (const entry of message.entries) {
          try {
            // Send MASTER_KEY string to indicate using internal master key
            let entryKeyHandle = bastionCrypto.decrypt(
              entry.encrypted_entry_key, 
              entry.encrypted_entry_key_nonce, 
              'MASTER_KEY', 
              true // returnAsHandle
            );
            
            if (entryKeyHandle && entryKeyHandle._isHandle) {
              let entryUrl = '';
              if (entry.encrypted_url && entry.encrypted_url_nonce) {
                const urlBytes = bastionCrypto.decrypt(
                  entry.encrypted_url, 
                  entry.encrypted_url_nonce, 
                  entryKeyHandle, 
                  false
                );
                entryUrl = Buffer.from(urlBytes).toString('utf8');
              }
              
              if (entryUrl && urlMatches(message.url, entryUrl)) {
                const dataBytes = bastionCrypto.decrypt(
                  entry.encrypted_data, 
                  entry.encrypted_data_nonce, 
                  entryKeyHandle, 
                  false
                );
                const data = JSON.parse(Buffer.from(dataBytes).toString('utf8'));
                matches.push({
                  id: entry.id,
                  url: entryUrl,
                  username: data.username,
                  password: data.password,
                });
              }
              bastionCrypto.destroyKey(entryKeyHandle);
            }
          } catch (err) {
            console.error('Failed processing entry', err);
          }
        }
        callback({ type: 'credentials-response', credentials: matches });
      } catch (err) {
        callback({ type: 'error', error: err.message });
      }
      break;

    case 'ping':
      callback({ type: 'pong' });
      break;

    default:
      callback({ type: 'error', error: 'Unknown message type' });
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
