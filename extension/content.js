// Content script - runs on web pages

let currentFields = null;

// Find login fields on the page
function findLoginFields() {
  const passwordFields = document.querySelectorAll('input[type="password"]');

  if (passwordFields.length === 0) {
    return null;
  }

  // Find username field (look for email or text input before password)
  const passwordField = passwordFields[0];
  let usernameField = null;

  // Look backwards from password field for username
  const form = passwordField.closest('form');
  if (form) {
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"]');
    for (const input of inputs) {
      if (input.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        usernameField = input;
      }
    }
  }

  return {
    username: usernameField,
    password: passwordField,
  };
}

// Add autofill button next to password field
function addAutofillButton(fields) {
  if (!fields.password) return;

  // Check if button already exists
  if (fields.password.dataset.vaultAutofill) return;

  fields.password.dataset.vaultAutofill = 'true';

  // Create button
  const button = document.createElement('button');
  button.textContent = 'Fill Password';
  button.style.cssText = `
    position: absolute;
    z-index: 10000;
    padding: 4px 8px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  `;

  // Position button
  const rect = fields.password.getBoundingClientRect();
  button.style.top = `${window.scrollY + rect.top}px`;
  button.style.left = `${window.scrollX + rect.right + 5}px`;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleAutofill(fields);
  });

  document.body.appendChild(button);

  // Update position on scroll
  const updatePosition = () => {
    const rect = fields.password.getBoundingClientRect();
    button.style.top = `${window.scrollY + rect.top}px`;
    button.style.left = `${window.scrollX + rect.right + 5}px`;
  };

  window.addEventListener('scroll', updatePosition);
  window.addEventListener('resize', updatePosition);
}

// Handle autofill
async function handleAutofill(fields) {
  try {
    // Check if vault is unlocked
    const { unlocked } = await chrome.runtime.sendMessage({ type: 'is-unlocked' });

    if (!unlocked) {
      // Try to unlock vault
      const unlockResult = await chrome.runtime.sendMessage({ type: 'unlock-vault' });

      if (unlockResult.error) {
        alert('Failed to unlock vault: ' + unlockResult.error);
        return;
      }
    }

    // Get credentials for current URL
    const result = await chrome.runtime.sendMessage({
      type: 'get-credentials',
      url: window.location.href,
    });

    if (result.error) {
      alert('Failed to get credentials: ' + result.error);
      return;
    }

    if (result.credentials.length === 0) {
      alert('No credentials found for this site');
      return;
    }

    // Use first matching credential
    const credential = result.credentials[0];

    // Fill fields
    if (fields.username && credential.username) {
      fields.username.value = credential.username;
      fields.username.dispatchEvent(new Event('input', { bubbles: true }));
      fields.username.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (fields.password && credential.password) {
      fields.password.value = credential.password;
      fields.password.dispatchEvent(new Event('input', { bubbles: true }));
      fields.password.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Clear credential from memory after a short delay
    setTimeout(() => {
      credential.password = null;
      credential.username = null;
    }, 100);

  } catch (error) {
    console.error('Autofill error:', error);
    alert('Autofill failed: ' + error.message);
  }
}

// Monitor page for login fields
function monitorPage() {
  const fields = findLoginFields();

  if (fields && fields.password) {
    currentFields = fields;
    addAutofillButton(fields);
  }
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', monitorPage);
} else {
  monitorPage();
}

// Also monitor for dynamic content
const observer = new MutationObserver(() => {
  monitorPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
