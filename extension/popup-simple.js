// Simple popup without native messaging
const API = 'http://localhost:3001/api';

async function init() {
  const { token } = await chrome.storage.local.get('token');
  if (token) {
    const { userEmail } = await chrome.storage.local.get('userEmail');
    showVault(userEmail);
  }
}

function showVault(email) {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('vault-view').classList.remove('hidden');
  document.getElementById('user-email').textContent = email;
}

document.getElementById('login-btn').onclick = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const error = document.getElementById('error');

  try {
    const res = await fetch(`${API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) throw new Error((await res.json()).error);

    const data = await res.json();
    await chrome.storage.local.set({
      token: data.token,
      userEmail: email,
      salt: data.salt,
      password: password
    });

    showVault(email);
  } catch (e) {
    error.textContent = e.message;
  }
};

document.getElementById('lock-btn').onclick = async () => {
  await chrome.storage.local.clear();
  location.reload();
};

document.getElementById('autofill-btn').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(tab.id, { type: 'autofill' });
  window.close();
};

init();
