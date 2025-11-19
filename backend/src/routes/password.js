import express from 'express';
import { generatePassword, calculateStrength } from '../../../shared/password-generator.js';

const router = express.Router();

/**
 * POST /api/password/generate
 * Generate a password based on requirements
 */
router.post('/generate', async (req, res) => {
  try {
    const { requirements } = req.body;

    if (!requirements) {
      return res.status(400).json({ error: 'Requirements object required' });
    }

    // Map frontend field names to generator field names
    const constraints = {
      minLength: requirements.minLength || 12,
      maxLength: requirements.maxLength || 20,
      requireUppercase: requirements.requireUppercase !== false,
      requireLowercase: requirements.requireLowercase !== false,
      requireDigit: requirements.requireNumbers !== false,
      requireSpecial: requirements.requireSpecial !== false,
      allowedSpecialChars: requirements.allowedSpecial ? requirements.allowedSpecial.split('') : null,
      disallowedChars: requirements.excludeAmbiguous ? ['0', 'O', 'o', 'l', '1', 'I'] : [],
    };

    // Generate password
    const password = generatePassword(constraints);

    // Calculate strength
    const score = calculateStrength(password);

    // Calculate entropy (bits)
    let charsetSize = 0;
    if (constraints.requireLowercase) charsetSize += 26;
    if (constraints.requireUppercase) charsetSize += 26;
    if (constraints.requireDigit) charsetSize += 10;
    if (constraints.requireSpecial) {
      charsetSize += constraints.allowedSpecialChars ?
        constraints.allowedSpecialChars.length :
        28; // Default special chars count
    }
    const entropy = password.length * Math.log2(charsetSize);

    // Estimate crack time
    let crackTime = 'Unknown';
    const guessesPerSecond = 1e9; // Assume 1 billion guesses/second
    const totalCombinations = Math.pow(charsetSize, password.length);
    const secondsToCrack = totalCombinations / (2 * guessesPerSecond); // Divide by 2 for average

    if (secondsToCrack < 60) {
      crackTime = 'Less than a minute';
    } else if (secondsToCrack < 3600) {
      crackTime = `${Math.ceil(secondsToCrack / 60)} minutes`;
    } else if (secondsToCrack < 86400) {
      crackTime = `${Math.ceil(secondsToCrack / 3600)} hours`;
    } else if (secondsToCrack < 31536000) {
      crackTime = `${Math.ceil(secondsToCrack / 86400)} days`;
    } else if (secondsToCrack < 3153600000) {
      crackTime = `${Math.ceil(secondsToCrack / 31536000)} years`;
    } else {
      crackTime = 'Centuries+';
    }

    res.json({
      password,
      strength: {
        score,
        entropy,
        crackTime,
      },
    });
  } catch (error) {
    console.error('Generate password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
