// Password generator integration for content script
import { scanPasswordConstraints, monitorPasswordErrors } from './password-scanner.js';
import { generatePassword, calculateStrength, getStrengthLabel, validatePassword } from '../shared/password-generator.js';

let currentConstraints = null;
let generatorUI = null;

/**
 * Initialize password generator on password fields
 */
export function initPasswordGenerator() {
  // Find password fields on signup/registration forms
  const passwordFields = findPasswordCreationFields();

  for (const field of passwordFields) {
    if (!field.dataset.vaultPasswordGen) {
      field.dataset.vaultPasswordGen = 'true';
      addGeneratorButton(field);
    }
  }

  // Monitor for errors to update constraints
  monitorPasswordErrors((updatedConstraints) => {
    if (currentConstraints) {
      currentConstraints = { ...currentConstraints, ...updatedConstraints };
    }
  });
}

/**
 * Find password creation fields (not login fields)
 */
function findPasswordCreationFields() {
  const fields = [];
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  for (const input of passwordInputs) {
    // Check if it's likely a password creation field
    const id = input.id || '';
    const name = input.name || '';
    const placeholder = input.placeholder || '';

    const text = (id + name + placeholder).toLowerCase();

    if (text.includes('new') ||
        text.includes('create') ||
        text.includes('signup') ||
        text.includes('register') ||
        text.includes('confirm')) {
      fields.push(input);
    }
  }

  // If no specific fields found, check if there are 2+ password fields (likely signup)
  if (fields.length === 0 && passwordInputs.length >= 2) {
    fields.push(passwordInputs[0]);
  }

  return fields;
}

/**
 * Add password generator button next to field
 */
function addGeneratorButton(field) {
  const button = document.createElement('button');
  button.textContent = 'Generate Password';
  button.type = 'button';
  button.className = 'vault-gen-password-btn';
  button.style.cssText = `
    position: absolute;
    z-index: 10000;
    padding: 6px 12px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-family: Arial, sans-serif;
  `;

  // Position button
  const rect = field.getBoundingClientRect();
  button.style.top = `${window.scrollY + rect.bottom + 5}px`;
  button.style.left = `${window.scrollX + rect.left}px`;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    showPasswordGenerator(field);
  });

  document.body.appendChild(button);

  // Update position on scroll/resize
  const updatePosition = () => {
    const rect = field.getBoundingClientRect();
    button.style.top = `${window.scrollY + rect.bottom + 5}px`;
    button.style.left = `${window.scrollX + rect.left}px`;
  };

  window.addEventListener('scroll', updatePosition);
  window.addEventListener('resize', updatePosition);
}

/**
 * Show password generator UI
 */
function showPasswordGenerator(field) {
  // Scan page for constraints
  currentConstraints = scanPasswordConstraints() || {};

  // Create UI if not exists
  if (!generatorUI) {
    generatorUI = createGeneratorUI();
  }

  // Position near field
  const rect = field.getBoundingClientRect();
  generatorUI.style.top = `${window.scrollY + rect.bottom + 40}px`;
  generatorUI.style.left = `${window.scrollX + rect.left}px`;
  generatorUI.style.display = 'block';

  // Generate initial password
  generateAndDisplay(field);
}

/**
 * Create password generator UI
 */
function createGeneratorUI() {
  const container = document.createElement('div');
  container.className = 'vault-password-generator';
  container.style.cssText = `
    position: absolute;
    z-index: 10001;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 350px;
    font-family: Arial, sans-serif;
  `;

  container.innerHTML = `
    <div style="margin-bottom: 15px;">
      <strong style="display: block; margin-bottom: 10px;">Generated Password</strong>
      <div style="display: flex; gap: 10px;">
        <input type="text" id="vault-gen-password-display" readonly
          style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;">
        <button id="vault-gen-regenerate" style="padding: 8px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Regenerate
        </button>
      </div>
    </div>

    <div style="margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <span style="font-size: 14px;">Strength:</span>
        <span id="vault-gen-strength-label" style="font-weight: bold;">-</span>
      </div>
      <div style="height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
        <div id="vault-gen-strength-bar" style="height: 100%; width: 0%; background: #4CAF50; transition: width 0.3s, background 0.3s;"></div>
      </div>
    </div>

    <div id="vault-gen-validation" style="margin-bottom: 15px; font-size: 12px; color: #666;"></div>

    <div style="display: flex; gap: 10px;">
      <button id="vault-gen-use" style="flex: 1; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
        Use This Password
      </button>
      <button id="vault-gen-cancel" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Cancel
      </button>
    </div>

    <div style="margin-top: 15px; font-size: 11px; color: #999;">
      Detected constraints: <span id="vault-gen-constraints"></span>
    </div>
  `;

  document.body.appendChild(container);

  // Event listeners
  container.querySelector('#vault-gen-cancel').addEventListener('click', () => {
    container.style.display = 'none';
  });

  return container;
}

/**
 * Generate password and update UI
 */
function generateAndDisplay(field) {
  const password = generatePassword(currentConstraints);
  const strength = calculateStrength(password);
  const label = getStrengthLabel(strength);
  const validation = validatePassword(password, currentConstraints);

  // Update UI
  const displayInput = generatorUI.querySelector('#vault-gen-password-display');
  const strengthBar = generatorUI.querySelector('#vault-gen-strength-bar');
  const strengthLabel = generatorUI.querySelector('#vault-gen-strength-label');
  const validationDiv = generatorUI.querySelector('#vault-gen-validation');
  const constraintsSpan = generatorUI.querySelector('#vault-gen-constraints');
  const useButton = generatorUI.querySelector('#vault-gen-use');

  displayInput.value = password;

  // Update strength bar
  strengthBar.style.width = `${strength}%`;
  strengthBar.style.background = strength < 30 ? '#f44336' :
                                  strength < 60 ? '#ff9800' :
                                  strength < 80 ? '#4CAF50' : '#2e7d32';
  strengthLabel.textContent = label;
  strengthLabel.style.color = strengthBar.style.background;

  // Show validation
  if (validation.valid) {
    validationDiv.innerHTML = '<span style="color: #4CAF50;">✓ Meets all requirements</span>';
  } else {
    validationDiv.innerHTML = validation.errors.map(err =>
      `<div style="color: #f44336;">✗ ${err}</div>`
    ).join('');
  }

  // Show constraints
  const constraintsList = [];
  if (currentConstraints.minLength) constraintsList.push(`min ${currentConstraints.minLength} chars`);
  if (currentConstraints.maxLength) constraintsList.push(`max ${currentConstraints.maxLength} chars`);
  if (currentConstraints.requireUppercase) constraintsList.push('uppercase');
  if (currentConstraints.requireLowercase) constraintsList.push('lowercase');
  if (currentConstraints.requireDigit) constraintsList.push('digit');
  if (currentConstraints.requireSpecial) constraintsList.push('special');

  constraintsSpan.textContent = constraintsList.join(', ') || 'none';

  // Regenerate button
  const regenButton = generatorUI.querySelector('#vault-gen-regenerate');
  regenButton.onclick = () => generateAndDisplay(field);

  // Use button
  useButton.onclick = () => {
    field.value = password;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    // Find confirm password field and fill it too
    const confirmField = findConfirmPasswordField(field);
    if (confirmField) {
      confirmField.value = password;
      confirmField.dispatchEvent(new Event('input', { bubbles: true }));
      confirmField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Offer to save to vault
    offerSaveToVault(password, field);

    generatorUI.style.display = 'none';
  };
}

/**
 * Find confirm password field
 */
function findConfirmPasswordField(originalField) {
  const form = originalField.closest('form');
  if (!form) return null;

  const passwordFields = form.querySelectorAll('input[type="password"]');

  for (const field of passwordFields) {
    if (field !== originalField) {
      const text = (field.id + field.name + field.placeholder).toLowerCase();
      if (text.includes('confirm') || text.includes('repeat') || text.includes('again')) {
        return field;
      }
    }
  }

  // Return next password field if exists
  if (passwordFields.length >= 2) {
    const index = Array.from(passwordFields).indexOf(originalField);
    if (index >= 0 && index < passwordFields.length - 1) {
      return passwordFields[index + 1];
    }
  }

  return null;
}

/**
 * Offer to save password to vault
 */
function offerSaveToVault(password, field) {
  // Show save prompt
  const prompt = document.createElement('div');
  prompt.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10002;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 300px;
  `;

  prompt.innerHTML = `
    <strong style="display: block; margin-bottom: 10px;">Save to Vault?</strong>
    <p style="font-size: 13px; color: #666; margin-bottom: 15px;">
      Do you want to save this password to your vault?
    </p>
    <div style="display: flex; gap: 10px;">
      <button id="vault-save-yes" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Save
      </button>
      <button id="vault-save-no" style="flex: 1; padding: 8px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
        No Thanks
      </button>
    </div>
  `;

  document.body.appendChild(prompt);

  prompt.querySelector('#vault-save-yes').addEventListener('click', () => {
    // Send message to background to save
    chrome.runtime.sendMessage({
      type: 'save-generated-password',
      url: window.location.href,
      password: password,
    });

    prompt.remove();
  });

  prompt.querySelector('#vault-save-no').addEventListener('click', () => {
    prompt.remove();
  });

  // Auto-remove after 10 seconds
  setTimeout(() => {
    prompt.remove();
  }, 10000);
}
