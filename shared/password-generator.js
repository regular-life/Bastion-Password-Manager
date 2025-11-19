// Password generator with constraint satisfaction

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Generate password that satisfies constraints
 * @param {object} constraints - Password constraints
 * @returns {string} Generated password
 */
export function generatePassword(constraints = {}) {
  const {
    minLength = 12,
    maxLength = null,
    requireUppercase = true,
    requireLowercase = true,
    requireDigit = true,
    requireSpecial = true,
    allowedSpecialChars = null,
    disallowedChars = [],
    pronounceable = false,
  } = constraints;

  // Determine target length
  const targetLength = maxLength ?
    Math.min(Math.max(minLength, 12), maxLength) :
    Math.max(minLength, 16);

  // Build character set
  let charset = '';
  const required = [];

  if (requireLowercase) {
    charset += LOWERCASE;
    required.push(LOWERCASE);
  }

  if (requireUppercase) {
    charset += UPPERCASE;
    required.push(UPPERCASE);
  }

  if (requireDigit) {
    charset += DIGITS;
    required.push(DIGITS);
  }

  if (requireSpecial) {
    const specialChars = allowedSpecialChars ?
      allowedSpecialChars.join('') :
      SPECIAL;
    charset += specialChars;
    required.push(specialChars);
  }

  // Remove disallowed characters
  for (const char of disallowedChars) {
    charset = charset.replace(new RegExp(char, 'g'), '');
  }

  if (charset.length === 0) {
    charset = LOWERCASE + UPPERCASE + DIGITS;
  }

  // Generate password
  let password = '';

  // First, ensure required characters are present
  for (const requiredSet of required) {
    const char = requiredSet[Math.floor(Math.random() * requiredSet.length)];
    password += char;
  }

  // Fill remaining length with random characters
  while (password.length < targetLength) {
    const char = charset[Math.floor(Math.random() * charset.length)];
    password += char;
  }

  // Shuffle the password
  password = shuffleString(password);

  // If pronounceable requested, try to make it more pronounceable
  if (pronounceable) {
    password = makePronounceable(password, constraints);
  }

  return password;
}

/**
 * Shuffle string randomly
 */
function shuffleString(str) {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * Make password more pronounceable
 */
function makePronounceable(password, constraints) {
  const vowels = 'aeiou';
  const consonants = 'bcdfghjklmnpqrstvwxyz';

  let result = '';
  let useVowel = Math.random() < 0.5;

  for (let i = 0; i < password.length; i++) {
    const char = password[i];

    if (LOWERCASE.includes(char.toLowerCase())) {
      // Alternate between vowels and consonants
      const pool = useVowel ? vowels : consonants;
      const isUpper = char === char.toUpperCase();

      let newChar = pool[Math.floor(Math.random() * pool.length)];
      if (isUpper) newChar = newChar.toUpperCase();

      result += newChar;
      useVowel = !useVowel;
    } else {
      // Keep digits and special characters
      result += char;
    }
  }

  return result;
}

/**
 * Calculate password strength score (0-100)
 */
export function calculateStrength(password) {
  let score = 0;

  // Length score (up to 40 points)
  score += Math.min(password.length * 2, 40);

  // Character variety (up to 40 points)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  score += variety * 10;

  // Entropy bonus (up to 20 points)
  const uniqueChars = new Set(password).size;
  score += Math.min((uniqueChars / password.length) * 20, 20);

  // Penalties
  // Repeated characters
  if (/(.)\1{2,}/.test(password)) score -= 10;

  // Sequential characters
  if (/abc|bcd|cde|123|234|345/i.test(password)) score -= 10;

  // Common patterns
  if (/password|123456|qwerty/i.test(password)) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * Get strength label
 */
export function getStrengthLabel(score) {
  if (score < 30) return 'Weak';
  if (score < 60) return 'Fair';
  if (score < 80) return 'Good';
  return 'Strong';
}

/**
 * Validate password against constraints
 */
export function validatePassword(password, constraints) {
  const errors = [];

  if (constraints.minLength && password.length < constraints.minLength) {
    errors.push(`Must be at least ${constraints.minLength} characters`);
  }

  if (constraints.maxLength && password.length > constraints.maxLength) {
    errors.push(`Must be at most ${constraints.maxLength} characters`);
  }

  if (constraints.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter');
  }

  if (constraints.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter');
  }

  if (constraints.requireDigit && !/[0-9]/.test(password)) {
    errors.push('Must contain a digit');
  }

  if (constraints.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Must contain a special character');
  }

  if (constraints.disallowedChars) {
    for (const char of constraints.disallowedChars) {
      if (password.includes(char)) {
        errors.push(`Cannot contain '${char}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
