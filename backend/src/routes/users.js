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

    // Generate salt and hash password
    const salt = randomBytes(16);
    const passwordHash = await argon2.hash(password, {
      ...ARGON2_CONFIG,
      salt,
    });

    console.log('Signup - Generated salt:', salt);
    console.log('Signup - Salt length:', salt.length, 'bytes');
    console.log('Signup - Password hash:', passwordHash.substring(0, 50) + '...');

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, salt) VALUES ($1, $2, $3) RETURNING id, email',
      [email, passwordHash, salt]
    );

    const user = result.rows[0];

    // Create session
    const token = await createSession(user.id);

    const saltBase64 = salt.toString('base64');
    console.log('Signup - Returning salt as base64:', saltBase64);
    console.log('Signup - Salt base64 length:', saltBase64.length);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
      // Return salt so client can derive master key
      salt: saltBase64,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/login
 * Authenticate user
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

    // Debug logging
    console.log('Login attempt for:', email);
    console.log('Password hash from DB:', user.password_hash.substring(0, 50) + '...');
    console.log('Salt from DB:', user.salt);
    console.log('Salt type:', typeof user.salt);
    console.log('Salt is Buffer?:', Buffer.isBuffer(user.salt));
    console.log('Salt length:', user.salt?.length);

    // Verify password
    const isValid = await argon2.verify(user.password_hash, password);

    console.log('Password verification result:', isValid);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const token = await createSession(user.id);

    // Ensure salt is a Buffer
    const saltBuffer = Buffer.isBuffer(user.salt) ? user.salt : Buffer.from(user.salt);
    const saltBase64 = saltBuffer.toString('base64');

    console.log('Returning salt as base64:', saltBase64);
    console.log('Salt base64 length:', saltBase64.length);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
      // Return salt so client can derive master key
      salt: saltBase64,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
