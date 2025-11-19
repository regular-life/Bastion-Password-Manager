import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { randomBytes, createHmac } from 'crypto';

const router = express.Router();

// All sharing routes require authentication
router.use(requireAuth);

const TOKEN_SECRET = process.env.TOKEN_SECRET || randomBytes(32).toString('hex');
const FILL_TOKEN_EXPIRY_SECONDS = 30; // Short-lived tokens

/**
 * POST /api/sharing/share
 * Share a credential with family
 * Client encrypts the entry key (content key) with owner's master key
 */
router.post('/share', async (req, res) => {
  try {
    const {
      credentialId,
      familyId,
      encrypted_content_key,
      encrypted_content_key_nonce,
    } = req.body;

    if (!familyId || !credentialId || !encrypted_content_key || !encrypted_content_key_nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify user owns the vault entry
      const entryCheck = await client.query(
        'SELECT id FROM vault_entries WHERE id = $1 AND user_id = $2',
        [credentialId, req.userId]
      );

      if (entryCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Vault entry not found' });
      }

      // Verify user is family owner
      const familyCheck = await client.query(
        'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, req.userId]
      );

      if (familyCheck.rows.length === 0 || familyCheck.rows[0].role !== 'owner') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Only family owner can share credentials' });
      }

      // Create shared credential (simplified - just store the encrypted content key)
      const result = await client.query(
        `INSERT INTO shared_credentials
         (family_id, vault_entry_id, owner_id, encrypted_content_key, encrypted_content_key_nonce)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (family_id, vault_entry_id)
         DO UPDATE SET
           encrypted_content_key = $4,
           encrypted_content_key_nonce = $5,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [familyId, credentialId, req.userId, encrypted_content_key, encrypted_content_key_nonce]
      );

      // Log action
      await client.query(
        'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, success) VALUES ($1, $2, $3, $4, true)',
        [familyId, result.rows[0].id, req.userId, 'share_credential']
      );

      await client.query('COMMIT');

      res.json({ shared_credential_id: result.rows[0].id });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Share credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sharing/unshare
 * Unshare (deactivate) a shared credential
 */
router.post('/unshare', async (req, res) => {
  try {
    const { sharedCredentialId } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify ownership
      const shareCheck = await client.query(
        'SELECT family_id FROM shared_credentials WHERE id = $1 AND owner_id = $2',
        [sharedCredentialId, req.userId]
      );

      if (shareCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Shared credential not found' });
      }

      // Deactivate share
      await client.query(
        'UPDATE shared_credentials SET is_active = false WHERE id = $1',
        [sharedCredentialId]
      );

      // Log action
      await client.query(
        'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, success) VALUES ($1, $2, $3, $4, true)',
        [shareCheck.rows[0].family_id, sharedCredentialId, req.userId, 'unshare_credential']
      );

      await client.query('COMMIT');

      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Unshare credential error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sharing/shared
 * Get shared credentials for a family
 */
router.get('/shared', async (req, res) => {
  try {
    const { familyId } = req.query;

    if (!familyId) {
      return res.status(400).json({ error: 'Family ID required' });
    }

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this family' });
    }

    const isOwner = memberCheck.rows[0].role === 'owner';

    // Get shared credentials with vault entry data
    const result = await pool.query(
      `SELECT
         sc.id,
         sc.vault_entry_id,
         sc.is_active,
         sc.created_at,
         sc.encrypted_content_key,
         sc.encrypted_content_key_nonce,
         ve.encrypted_data,
         ve.encrypted_data_nonce,
         ve.encrypted_url,
         ve.encrypted_url_nonce,
         u.email as owner_email
       FROM shared_credentials sc
       JOIN vault_entries ve ON sc.vault_entry_id = ve.id
       JOIN users u ON sc.owner_id = u.id
       WHERE sc.family_id = $1 AND sc.is_active = true
       ORDER BY sc.created_at DESC`,
      [familyId]
    );

    res.json({ credentials: result.rows });
  } catch (error) {
    console.error('Get shared credentials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sharing/request-fill-token
 * Member requests a fill token for autofill (delegation flow)
 * Returns a short-lived, single-use token
 */
router.post('/request-fill-token', async (req, res) => {
  try {
    const { sharedCredentialId, origin } = req.body;

    if (!sharedCredentialId || !origin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get shared credential
      const shareResult = await client.query(
        `SELECT sc.id, sc.family_id, sc.encrypted_credential,
                sc.encrypted_credential_nonce, sc.allowed_domains, sc.is_active
         FROM shared_credentials sc
         WHERE sc.id = $1`,
        [sharedCredentialId]
      );

      if (shareResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Shared credential not found' });
      }

      const share = shareResult.rows[0];

      if (!share.is_active) {
        await client.query('ROLLBACK');

        // Log failed attempt
        await pool.query(
          'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, origin, success, metadata) VALUES ($1, $2, $3, $4, $5, false, $6)',
          [share.family_id, sharedCredentialId, req.userId, 'request_fill_token', origin, JSON.stringify({ reason: 'inactive' })]
        );

        return res.status(403).json({ error: 'Credential sharing has been revoked' });
      }

      // Verify user is family member (not owner)
      const memberCheck = await client.query(
        'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
        [share.family_id, req.userId]
      );

      if (memberCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not a member of this family' });
      }

      // Verify origin is in allowed domains
      let originAllowed = false;
      const allowedDomains = share.allowed_domains || [];

      if (allowedDomains.length === 0) {
        originAllowed = true; // No restrictions
      } else {
        try {
          const originUrl = new URL(origin);
          for (const domain of allowedDomains) {
            if (originUrl.hostname === domain ||
                originUrl.hostname.endsWith('.' + domain)) {
              originAllowed = true;
              break;
            }
          }
        } catch (err) {
          originAllowed = false;
        }
      }

      if (!originAllowed) {
        await client.query('ROLLBACK');

        // Log failed attempt
        await pool.query(
          'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, origin, success, metadata) VALUES ($1, $2, $3, $4, $5, false, $6)',
          [share.family_id, sharedCredentialId, req.userId, 'request_fill_token', origin, JSON.stringify({ reason: 'origin_not_allowed' })]
        );

        return res.status(403).json({ error: 'Origin not allowed for this credential' });
      }

      // Generate fill token
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + FILL_TOKEN_EXPIRY_SECONDS * 1000);

      // Generate ephemeral key for this token
      const ephemeralKey = randomBytes(32);

      // Sign the token with server secret
      const signature = createHmac('sha256', TOKEN_SECRET)
        .update(token + origin + sharedCredentialId + req.userId)
        .digest('base64url');

      // Store ephemeral key (in production, encrypt this)
      const ephemeralKeyBase64 = ephemeralKey.toString('base64');

      await client.query(
        `INSERT INTO fill_tokens
         (token, shared_credential_id, member_id, ephemeral_key_encrypted,
          ephemeral_key_nonce, allowed_origin, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [token, sharedCredentialId, req.userId, ephemeralKeyBase64, 'nonce-placeholder', origin, expiresAt]
      );

      // Log successful request
      await client.query(
        'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, origin, success) VALUES ($1, $2, $3, $4, $5, true)',
        [share.family_id, sharedCredentialId, req.userId, 'request_fill_token', origin]
      );

      await client.query('COMMIT');

      res.json({
        fillToken: token,
        signature,
        encryptedCredential: share.encrypted_credential,
        encryptedCredentialNonce: share.encrypted_credential_nonce,
        ephemeralKey: ephemeralKeyBase64, // In production, derive this from token
        expiresAt,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Request fill token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/sharing/use-fill-token
 * Mark fill token as used (single-use enforcement)
 */
router.post('/use-fill-token', async (req, res) => {
  try {
    const { token } = req.body;

    const result = await pool.query(
      `UPDATE fill_tokens
       SET used_at = NOW()
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING shared_credential_id, member_id, allowed_origin`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const { shared_credential_id, member_id, allowed_origin } = result.rows[0];

    // Get family_id for audit log
    const shareResult = await pool.query(
      'SELECT family_id FROM shared_credentials WHERE id = $1',
      [shared_credential_id]
    );

    // Log usage
    await pool.query(
      'INSERT INTO audit_log (family_id, shared_credential_id, user_id, action, origin, success) VALUES ($1, $2, $3, $4, $5, true)',
      [shareResult.rows[0].family_id, shared_credential_id, member_id, 'use_fill_token', allowed_origin]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Use fill token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/sharing/audit/:familyId
 * Get audit logs for family (owner only)
 */
router.get('/audit/:familyId', async (req, res) => {
  try {
    const { familyId } = req.params;
    const { limit = 100 } = req.query;

    // Verify user is family owner
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only family owner can view audit logs' });
    }

    // Get audit logs
    const result = await pool.query(
      `SELECT al.id, al.action, al.origin, al.success, al.metadata,
              al.created_at, u.email as user_email
       FROM audit_log al
       JOIN users u ON al.user_id = u.id
       WHERE al.family_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [familyId, parseInt(limit)]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
