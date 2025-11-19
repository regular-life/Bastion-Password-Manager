// Background service worker for extension

let cachedVault = null;
let cachedMasterKey = null;
let cachedToken = null;
let cachedEmail = null;

const API_BASE = 'http://localhost:3001/api';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get-credentials':
      handleGetCredentials(message.url)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'login':
      handleLogin(message.token, message.email, message.masterKey)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'lock-vault':
      handleLockVault();
      sendResponse({ success: true });
      break;

    case 'is-unlocked':
      sendResponse({ unlocked: cachedMasterKey !== null, email: cachedEmail });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Handle login - store credentials and fetch vault
 */
async function handleLogin(token, email, masterKeyArray) {
  try {
    cachedToken = token;
    cachedEmail = email;
    cachedMasterKey = new Uint8Array(masterKeyArray);

    // Fetch vault entries from server
    const response = await fetch(`${API_BASE}/vault`, {
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
    cachedToken = null;
    cachedEmail = null;
    cachedVault = null;
    throw error;
  }
}

/**
 * Lock vault - clear cached data
 */
function handleLockVault() {
  if (cachedMasterKey) {
    for (let i = 0; i < cachedMasterKey.length; i++) {
      cachedMasterKey[i] = 0;
    }
    cachedMasterKey = null;
  }
  cachedVault = null;
  cachedToken = null;
  cachedEmail = null;
}

/**
 * Get credentials for a specific URL
 */
async function handleGetCredentials(url) {
  if (!cachedMasterKey || !cachedVault) {
    throw new Error('Vault is locked. Please login through the extension popup.');
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
