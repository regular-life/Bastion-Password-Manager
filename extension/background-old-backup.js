// Background service worker for extension

const NATIVE_HOST_NAME = 'com.secure_vault.native';
let cachedVault = null;
let cachedMasterKey = null;

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get-credentials':
      handleGetCredentials(message.url)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true; // Will respond asynchronously

    case 'unlock-vault':
      handleUnlockVault()
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'lock-vault':
      handleLockVault();
      sendResponse({ success: true });
      break;

    case 'is-unlocked':
      sendResponse({ unlocked: cachedMasterKey !== null });
      break;

    case 'get-shared-credentials':
      handleGetSharedCredentials(message.url)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'request-masked-fill':
      handleMaskedFill(message.sharedCredentialId, message.origin)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Get master key from desktop app via native messaging
 */
async function getMasterKeyFromDesktop() {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

    port.onMessage.addListener((response) => {
      if (response.type === 'master-key') {
        resolve(new Uint8Array(response.key));
      } else {
        reject(new Error(response.error || 'Failed to get master key'));
      }
      port.disconnect();
    });

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        reject(new Error('Desktop app not running or not connected'));
      }
    });

    port.postMessage({ type: 'get-master-key' });
  });
}

/**
 * Unlock vault - get master key and fetch encrypted vault
 */
async function handleUnlockVault() {
  try {
    // Get master key from desktop app
    cachedMasterKey = await getMasterKeyFromDesktop();

    // Get token from storage
    const { token } = await chrome.storage.local.get('token');

    if (!token) {
      throw new Error('Not logged in');
    }

    // Fetch encrypted vault from server
    const response = await fetch('http://localhost:3001/api/vault', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch vault');
    }

    const data = await response.json();
    cachedVault = data.entries;

    return { success: true };
  } catch (error) {
    cachedMasterKey = null;
    cachedVault = null;
    throw error;
  }
}

/**
 * Lock vault - clear cached data
 */
function handleLockVault() {
  if (cachedMasterKey) {
    // Clear master key from memory
    for (let i = 0; i < cachedMasterKey.length; i++) {
      cachedMasterKey[i] = 0;
    }
    cachedMasterKey = null;
  }
  cachedVault = null;
}

/**
 * Get credentials for a specific URL
 */
async function handleGetCredentials(url) {
  if (!cachedMasterKey || !cachedVault) {
    throw new Error('Vault is locked');
  }

  try {
    // Import crypto utilities
    const { decrypt, bytesToString } = await import('./crypto-lib.js');

    // Find matching entries
    const matches = [];

    for (const entry of cachedVault) {
      try {
        // Decrypt entry key
        const entryKey = decrypt(
          entry.encrypted_entry_key,
          entry.encrypted_entry_key_nonce,
          cachedMasterKey
        );

        // Decrypt URL if present
        let entryUrl = '';
        if (entry.encrypted_url && entry.encrypted_url_nonce) {
          const urlBytes = decrypt(
            entry.encrypted_url,
            entry.encrypted_url_nonce,
            entryKey
          );
          entryUrl = bytesToString(urlBytes);
        }

        // Check if URL matches
        if (entryUrl && urlMatches(url, entryUrl)) {
          // Decrypt data
          const dataBytes = decrypt(
            entry.encrypted_data,
            entry.encrypted_data_nonce,
            entryKey
          );
          const data = JSON.parse(bytesToString(dataBytes));

          matches.push({
            id: entry.id,
            url: entryUrl,
            username: data.username,
            password: data.password,
          });
        }

        // Clear entry key from memory
        for (let i = 0; i < entryKey.length; i++) {
          entryKey[i] = 0;
        }
      } catch (err) {
        console.error('Failed to decrypt entry:', err);
      }
    }

    return { credentials: matches };
  } catch (error) {
    throw error;
  }
}

/**
 * Check if two URLs match (same domain)
 */
function urlMatches(currentUrl, savedUrl) {
  try {
    const current = new URL(currentUrl);
    const saved = new URL(savedUrl);

    // Match if hostnames are the same or saved is a subdomain
    return current.hostname === saved.hostname ||
           current.hostname.endsWith('.' + saved.hostname) ||
           saved.hostname.endsWith('.' + current.hostname);
  } catch (err) {
    return false;
  }
}

// Auto-lock vault after 15 minutes of inactivity
let lockTimer = null;

function resetLockTimer() {
  if (lockTimer) {
    clearTimeout(lockTimer);
  }
  lockTimer = setTimeout(() => {
    handleLockVault();
  }, 15 * 60 * 1000); // 15 minutes
}

chrome.runtime.onMessage.addListener(() => {
  if (cachedMasterKey) {
    resetLockTimer();
  }
});
