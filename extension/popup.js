// Popup script with login

const loginView = document.getElementById('login-view');
const unlockedView = document.getElementById('unlocked-view');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const lockBtn = document.getElementById('lock-btn');
const loginError = document.getElementById('login-error');
const userEmailSpan = document.getElementById('user-email');

const API_BASE = 'http://localhost:3001/api';

async function updateUI() {
  const result = await chrome.runtime.sendMessage({ type: 'is-unlocked' });

  if (result.unlocked) {
    loginView.classList.add('hidden');
    unlockedView.classList.remove('hidden');
    userEmailSpan.textContent = result.email || 'Unknown';
  } else {
    loginView.classList.remove('hidden');
    unlockedView.classList.add('hidden');
  }
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Please enter both email and password';
    return;
  }

  try {
    loginBtn.textContent = 'Logging in...';
    loginBtn.disabled = true;
    loginError.textContent = '';

    // Login to get token and salt
    const loginResponse = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(error.error || 'Login failed');
    }

    const { token, salt } = await loginResponse.json();

    // Send to background script to cache
    const unlockResult = await chrome.runtime.sendMessage({
      type: 'login',
      token,
      email,
    });

    if (unlockResult.error) {
      throw new Error(unlockResult.error);
    }

    // Clear password input
    passwordInput.value = '';

    await updateUI();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    loginBtn.textContent = 'Login';
    loginBtn.disabled = false;
  }
});

lockBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'lock-vault' });
  emailInput.value = '';
  passwordInput.value = '';
  await updateUI();
});

// Update UI on load
updateUI();
