// Background service worker for extension

let cachedVault = null;
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
      handleLogin(message.token, message.email)
        .then(sendResponse)
        .catch(err => sendResponse({ error: err.message }));
      return true;

    case 'lock-vault':
      handleLockVault();
      sendResponse({ success: true });
      break;

    case 'is-unlocked':
      sendResponse({ unlocked: cachedToken !== null, email: cachedEmail });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Handle login - store credentials and fetch vault
 */
async function handleLogin(token, email) {
  try {
    cachedToken = token;
    cachedEmail = email;

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
  cachedVault = null;
  cachedToken = null;
  cachedEmail = null;
}

/**
 * Get credentials for a specific URL
 */
async function handleGetCredentials(url) {
  if (!cachedVault) {
    throw new Error('Extension is locked. Please login via the popup.');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage('com.bastion.native', {
      type: 'get-credentials',
      url: url,
      entries: cachedVault
    }, (response) => {
      if (chrome.runtime.lastError) {
         console.error('Native messaging error:', chrome.runtime.lastError.message);
         reject(new Error('Cannot communicate with Bastion Desktop App. Please ensure it is running to decrypt credentials.'));
         return;
      }
      
      if (response && response.type === 'credentials-response') {
        resolve({ credentials: response.credentials });
      } else if (response && response.error) {
        reject(new Error(`Decryption failed: ${response.error}`));
      } else {
        reject(new Error('Unknown response from Desktop App'));
      }
    });
  });
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
  if (cachedToken) {
    resetLockTimer();
  }
});
