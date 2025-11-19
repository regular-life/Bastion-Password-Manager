import { pool } from './db.js';
import { randomBytes } from 'crypto';

const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS || '24');

/**
 * Create a new session token for a user
 */
export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  return token;
}

/**
 * Verify a session token and return user ID
 */
export async function verifySession(token) {
  const result = await pool.query(
    'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].user_id;
}

/**
 * Delete a session
 */
export async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}

/**
 * Middleware to authenticate requests
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  verifySession(token)
    .then((userId) => {
      if (!userId) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      req.userId = userId;
      next();
    })
    .catch((error) => {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
}
