import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { randomBytes, createHmac } from 'crypto';

const router = express.Router();

// All family routes require authentication
router.use(requireAuth);

/**
 * POST /api/family/create
 * Create a new family
 */
router.post('/create', async (req, res) => {
  try {
    const { familyName, encryptedFamilyKey, encryptedFamilyKeyNonce } = req.body;
    const name = familyName;

    if (!name || !encryptedFamilyKey || !encryptedFamilyKeyNonce) {
      return res.status(400).json({ error: 'Family name and encrypted family key required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create family
      const familyResult = await client.query(
        'INSERT INTO families (name, owner_id) VALUES ($1, $2) RETURNING id, name, created_at',
        [name, req.userId]
      );

      const family = familyResult.rows[0];

      // Add owner as member
      await client.query(
        'INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, $3)',
        [family.id, req.userId, 'owner']
      );

      // Store encrypted family key for owner
      await client.query(
        'INSERT INTO family_keys (family_id, user_id, encrypted_family_key, encrypted_family_key_nonce) VALUES ($1, $2, $3, $4)',
        [family.id, req.userId, encryptedFamilyKey, encryptedFamilyKeyNonce]
      );

      // Log action
      await client.query(
        'INSERT INTO audit_log (family_id, user_id, action, success) VALUES ($1, $2, $3, true)',
        [family.id, req.userId, 'create_family']
      );

      await client.query('COMMIT');

      res.status(201).json({ family });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create family error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/family/my-family
 * Get all families for current user
 */
router.get('/my-family', async (req, res) => {
  try {
    // Get user's families
    const familiesResult = await pool.query(
      `SELECT f.id, f.name, f.owner_id, fm.role, f.created_at
       FROM families f
       JOIN family_members fm ON f.id = fm.family_id
       WHERE fm.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.userId]
    );

    const families = familiesResult.rows;

    // For each family, get member count (optional, but good for UI)
    for (const family of families) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM family_members WHERE family_id = $1',
        [family.id]
      );
      family.memberCount = parseInt(countResult.rows[0].count);
    }

    res.json({ families });
  } catch (error) {
    console.error('Get families error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/family/invite
 * Create invite link for family
 */
router.post('/invite', async (req, res) => {
  try {
    const { familyId } = req.body;
    const { expiresInHours = 168 } = req.body; // Default 7 days

    // Verify user is owner
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only family owner can create invites' });
    }

    // Generate secure token
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO family_invites (family_id, token, created_by, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, token, expires_at`,
      [familyId, token, req.userId, expiresAt]
    );

    // Log action
    await pool.query(
      'INSERT INTO audit_log (family_id, user_id, action, success, metadata) VALUES ($1, $2, $3, true, $4)',
      [familyId, req.userId, 'create_invite', JSON.stringify({ invite_id: result.rows[0].id })]
    );

    res.json({
      token: result.rows[0].token,
      invite: result.rows[0],
    });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/family/join
 * Accept family invite
 */
router.post('/join', async (req, res) => {
  try {
    const { token, encryptedFamilyKey, encryptedFamilyKeyNonce } = req.body;

    if (!encryptedFamilyKey || !encryptedFamilyKeyNonce) {
      return res.status(400).json({ error: 'Encrypted family key required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get invite
      const inviteResult = await client.query(
        `SELECT id, family_id, expires_at, used_at
         FROM family_invites
         WHERE token = $1`,
        [token]
      );

      if (inviteResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invalid invite link' });
      }

      const invite = inviteResult.rows[0];

      // Check if already used
      if (invite.used_at) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invite already used' });
      }

      // Check if expired
      if (new Date() > new Date(invite.expires_at)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invite expired' });
      }

      // Check if user is already a member
      const memberCheck = await client.query(
        'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
        [invite.family_id, req.userId]
      );

      if (memberCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Already a member of this family' });
      }

      // Add user as member
      await client.query(
        'INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, $3)',
        [invite.family_id, req.userId, 'member']
      );

      // Store encrypted family key for member
      await client.query(
        'INSERT INTO family_keys (family_id, user_id, encrypted_family_key, encrypted_family_key_nonce) VALUES ($1, $2, $3, $4)',
        [invite.family_id, req.userId, encryptedFamilyKey, encryptedFamilyKeyNonce]
      );

      // Mark invite as used
      await client.query(
        'UPDATE family_invites SET used_at = NOW(), used_by = $1 WHERE id = $2',
        [req.userId, invite.id]
      );

      // Log action
      await client.query(
        'INSERT INTO audit_log (family_id, user_id, action, success, metadata) VALUES ($1, $2, $3, true, $4)',
        [invite.family_id, req.userId, 'join_family', JSON.stringify({ invite_id: invite.id })]
      );

      await client.query('COMMIT');

      // Get family info
      const familyResult = await client.query(
        'SELECT id, name, created_at FROM families WHERE id = $1',
        [invite.family_id]
      );

      res.json({ family: familyResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Join family error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/family/:familyId/members
 * Get family members
 */
router.get('/:familyId/members', async (req, res) => {
  try {
    const { familyId } = req.params;

    // Verify user is member
    const memberCheck = await pool.query(
      'SELECT id FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this family' });
    }

    // Get members
    const result = await pool.query(
      `SELECT fm.id, fm.role, fm.joined_at, u.id as user_id, u.email
       FROM family_members fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_id = $1
       ORDER BY fm.joined_at ASC`,
      [familyId]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/family/remove-member
 * Remove a member from family (owner only)
 */
router.post('/remove-member', async (req, res) => {
  try {
    const { familyId, userId } = req.body;

    // Verify requester is owner
    const ownerCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only family owner can remove members' });
    }

    // Verify target user is a member and not the owner
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member of this family' });
    }

    if (memberCheck.rows[0].role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove family owner' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove member
      await client.query(
        'DELETE FROM family_members WHERE family_id = $1 AND user_id = $2',
        [familyId, userId]
      );

      // Log action
      await client.query(
        'INSERT INTO audit_log (family_id, user_id, action, success, metadata) VALUES ($1, $2, $3, true, $4)',
        [familyId, req.userId, 'remove_member', JSON.stringify({ removed_user_id: userId })]
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
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/family/:familyId/key
 * Get user's encrypted family key
 */
router.get('/:familyId/key', async (req, res) => {
  try {
    const { familyId } = req.params;

    // Get user's encrypted family key
    const result = await pool.query(
      'SELECT encrypted_family_key, encrypted_family_key_nonce FROM family_keys WHERE family_id = $1 AND user_id = $2',
      [familyId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Family key not found' });
    }

    res.json({
      encryptedFamilyKey: result.rows[0].encrypted_family_key,
      encryptedFamilyKeyNonce: result.rows[0].encrypted_family_key_nonce,
    });
  } catch (error) {
    console.error('Get family key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
