import express from 'express';
import { pool } from '../db.js';
import { createSession } from '../auth.js';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';

const router = express.Router();

const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * POST /api/users/signup
 * Create a new user account
 * FIXED VERSION: Let argon2 generate its own salt
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Generate salt for client-side key derivation (separate from auth)
    const clientSalt = randomBytes(16);

    // Hash password for authentication (argon2 generates its own salt internally)
    const passwordHash = await argon2.hash(password, ARGON2_CONFIG);

    console.log('Signup - Client salt:', clientSalt.toString('hex'));
    console.log('Signup - Password hash:', passwordHash.substring(0, 50) + '...');

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, salt) VALUES ($1, $2, $3) RETURNING id, email',
      [email, passwordHash, clientSalt]
    );

    const user = result.rows[0];

    // Create session
    const token = await createSession(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
      // Return salt so client can derive master key
      salt: clientSalt.toString('base64'),
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/login
 * Authenticate user
 * FIXED VERSION: Just verify hash directly
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const result = await pool.query(
      'SELECT id, email, password_hash, salt FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    console.log('Login attempt for:', email);
    console.log('Password hash type:', typeof user.password_hash);
    console.log('Password hash:', user.password_hash.substring(0, 60));

    // Verify password - argon2.verify handles the salt automatically
    try {
      const isValid = await argon2.verify(user.password_hash, password);
      console.log('Password verification result:', isValid);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (verifyError) {
      console.error('Argon2 verify error:', verifyError);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const token = await createSession(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
      // Return salt so client can derive master key
      salt: user.salt.toString('base64'),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
