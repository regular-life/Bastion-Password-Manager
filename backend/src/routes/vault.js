import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// All vault routes require authentication
router.use(requireAuth);

/**
 * GET /api/vault
 * Get all vault entries for authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, encrypted_entry_key, encrypted_entry_key_nonce,
              encrypted_data, encrypted_data_nonce,
              encrypted_url, encrypted_url_nonce,
              created_at, updated_at
       FROM vault_entries
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/vault
 * Create a new vault entry
 */
router.post('/', async (req, res) => {
  try {
    const {
      encrypted_entry_key,
      encrypted_entry_key_nonce,
      encrypted_data,
      encrypted_data_nonce,
      encrypted_url,
      encrypted_url_nonce,
    } = req.body;

    if (!encrypted_entry_key || !encrypted_entry_key_nonce ||
        !encrypted_data || !encrypted_data_nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO vault_entries
       (user_id, encrypted_entry_key, encrypted_entry_key_nonce,
        encrypted_data, encrypted_data_nonce,
        encrypted_url, encrypted_url_nonce)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at, updated_at`,
      [
        req.userId,
        encrypted_entry_key,
        encrypted_entry_key_nonce,
        encrypted_data,
        encrypted_data_nonce,
        encrypted_url || null,
        encrypted_url_nonce || null,
      ]
    );

    res.status(201).json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error('Create vault entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/vault/:id
 * Update a vault entry
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      encrypted_entry_key,
      encrypted_entry_key_nonce,
      encrypted_data,
      encrypted_data_nonce,
      encrypted_url,
      encrypted_url_nonce,
    } = req.body;

    if (!encrypted_entry_key || !encrypted_entry_key_nonce ||
        !encrypted_data || !encrypted_data_nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `UPDATE vault_entries
       SET encrypted_entry_key = $1,
           encrypted_entry_key_nonce = $2,
           encrypted_data = $3,
           encrypted_data_nonce = $4,
           encrypted_url = $5,
           encrypted_url_nonce = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8
       RETURNING updated_at`,
      [
        encrypted_entry_key,
        encrypted_entry_key_nonce,
        encrypted_data,
        encrypted_data_nonce,
        encrypted_url || null,
        encrypted_url_nonce || null,
        id,
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ updated_at: result.rows[0].updated_at });
  } catch (error) {
    console.error('Update vault entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/vault/:id
 * Delete a vault entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM vault_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete vault entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
