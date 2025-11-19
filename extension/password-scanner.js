// Page scanner - extracts password rules from registration pages

/**
 * Scan page for password field and extract constraints
 */
export function scanPasswordConstraints() {
  const constraints = {
    minLength: 8,
    maxLength: null,
    requireUppercase: false,
    requireLowercase: false,
    requireDigit: false,
    requireSpecial: false,
    allowedSpecialChars: null,
    disallowedChars: [],
    customRules: [],
  };

  // Find password input fields
  const passwordFields = document.querySelectorAll('input[type="password"]');

  if (passwordFields.length === 0) {
    return null;
  }

  const passwordField = passwordFields[0];

  // Extract from HTML attributes
  extractFromAttributes(passwordField, constraints);

  // Extract from nearby text (labels, hints, error messages)
  extractFromHints(passwordField, constraints);

  // Extract from aria-describedby
  extractFromAria(passwordField, constraints);

  return constraints;
}

/**
 * Extract constraints from HTML attributes
 */
function extractFromAttributes(field, constraints) {
  // maxlength attribute
  if (field.maxLength && field.maxLength > 0) {
    constraints.maxLength = field.maxLength;
  }

  // minlength attribute
  if (field.minLength && field.minLength > 0) {
    constraints.minLength = field.minLength;
  }

  // pattern attribute (regex)
  if (field.pattern) {
    parsePattern(field.pattern, constraints);
  }

  // Check for data attributes
  const minAttr = field.getAttribute('data-min-length') || field.getAttribute('data-minlength');
  const maxAttr = field.getAttribute('data-max-length') || field.getAttribute('data-maxlength');

  if (minAttr) {
    const min = parseInt(minAttr);
    if (!isNaN(min)) {
      constraints.minLength = Math.max(constraints.minLength, min);
    }
  }

  if (maxAttr) {
    const max = parseInt(maxAttr);
    if (!isNaN(max)) {
      constraints.maxLength = max;
    }
  }
}

/**
 * Parse regex pattern for constraints
 */
function parsePattern(pattern, constraints) {
  try {
    // Common patterns
    if (pattern.includes('[A-Z]') || pattern.includes('[a-z]')) {
      if (pattern.includes('[A-Z]')) constraints.requireUppercase = true;
      if (pattern.includes('[a-z]')) constraints.requireLowercase = true;
    }

    if (pattern.includes('[0-9]') || pattern.includes('\\d')) {
      constraints.requireDigit = true;
    }

    // Extract min/max length from pattern
    const lengthMatch = pattern.match(/\{(\d+),?(\d+)?\}/);
    if (lengthMatch) {
      const min = parseInt(lengthMatch[1]);
      const max = lengthMatch[2] ? parseInt(lengthMatch[2]) : null;

      if (!isNaN(min)) constraints.minLength = Math.max(constraints.minLength, min);
      if (max && !isNaN(max)) constraints.maxLength = max;
    }

    // Special characters
    const specialMatch = pattern.match(/\[([^\]]+)\]/g);
    if (specialMatch) {
      for (const match of specialMatch) {
        if (match.includes('!@#$%') || match.includes('*&^')) {
          constraints.requireSpecial = true;
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse pattern:', err);
  }
}

/**
 * Extract hints from nearby text
 */
function extractFromHints(field, constraints) {
  // Get surrounding text (labels, hints, helper text)
  const hints = [];

  // Check labels
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (label.htmlFor === field.id || label.contains(field)) {
      hints.push(label.textContent);
    }
  }

  // Check nearby elements (siblings, parent)
  const parent = field.parentElement;
  if (parent) {
    const siblings = parent.querySelectorAll('span, div, p, small');
    for (const sibling of siblings) {
      hints.push(sibling.textContent);
    }
  }

  // Check form helper text
  const form = field.closest('form');
  if (form) {
    const helpers = form.querySelectorAll('.helper-text, .hint, .help-block, .form-text');
    for (const helper of helpers) {
      hints.push(helper.textContent);
    }
  }

  // Parse hints with NLP rules
  const allText = hints.join(' ').toLowerCase();
  parseHintText(allText, constraints);
}

/**
 * Extract from aria-describedby
 */
function extractFromAria(field, constraints) {
  const describedBy = field.getAttribute('aria-describedby');
  if (describedBy) {
    const elements = describedBy.split(' ').map(id => document.getElementById(id));
    for (const el of elements) {
      if (el) {
        const text = el.textContent.toLowerCase();
        parseHintText(text, constraints);
      }
    }
  }
}

/**
 * NLP parser for hint text
 */
function parseHintText(text, constraints) {
  // Length constraints
  const lengthPatterns = [
    /at least (\d+) characters?/i,
    /minimum (\d+) characters?/i,
    /min(?:imum)?\s*:?\s*(\d+)/i,
    /(\d+)\s*characters? (?:or|to) (\d+)/i,
    /between (\d+) and (\d+) characters?/i,
    /(\d+)-(\d+) characters?/i,
  ];

  for (const pattern of lengthPatterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1]);
      if (!isNaN(min)) {
        constraints.minLength = Math.max(constraints.minLength, min);
      }

      if (match[2]) {
        const max = parseInt(match[2]);
        if (!isNaN(max)) {
          constraints.maxLength = max;
        }
      }
    }
  }

  // Maximum length
  const maxPatterns = [
    /maximum (\d+) characters?/i,
    /max(?:imum)?\s*:?\s*(\d+)/i,
    /up to (\d+) characters?/i,
  ];

  for (const pattern of maxPatterns) {
    const match = text.match(pattern);
    if (match) {
      const max = parseInt(match[1]);
      if (!isNaN(max)) {
        constraints.maxLength = max;
      }
    }
  }

  // Character requirements
  if (/(must|should|require[ds]?).*uppercase/i.test(text) ||
      /uppercase.*(?:letter|character)/i.test(text) ||
      /capital letter/i.test(text)) {
    constraints.requireUppercase = true;
  }

  if (/(must|should|require[ds]?).*lowercase/i.test(text) ||
      /lowercase.*(?:letter|character)/i.test(text)) {
    constraints.requireLowercase = true;
  }

  if (/(must|should|require[ds]?).*(?:number|digit)/i.test(text) ||
      /(?:number|digit)/i.test(text)) {
    constraints.requireDigit = true;
  }

  if (/(must|should|require[ds]?).*special.*character/i.test(text) ||
      /special.*(?:character|symbol)/i.test(text)) {
    constraints.requireSpecial = true;
  }

  // Allowed special characters
  const specialMatch = text.match(/allowed.*(?:symbols?|characters?)\s*:?\s*([!@#$%^&*()_+=\-[\]{};:'",.<>?/\\|`~]+)/i);
  if (specialMatch) {
    constraints.allowedSpecialChars = specialMatch[1].split('');
  }

  // No special characters
  if (/no special characters?/i.test(text) ||
      /(?:cannot|must not).*contain.*special/i.test(text)) {
    constraints.requireSpecial = false;
    constraints.allowedSpecialChars = [];
  }
}

/**
 * Monitor page for error messages and update constraints
 */
export function monitorPasswordErrors(callback) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent.toLowerCase();

          // Check if it's an error message
          if (node.classList.contains('error') ||
              node.classList.contains('invalid') ||
              node.getAttribute('role') === 'alert' ||
              text.includes('must') || text.includes('required')) {

            // Extract updated constraints from error
            const constraints = {};
            parseHintText(text, constraints);

            if (Object.keys(constraints).length > 0) {
              callback(constraints);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
