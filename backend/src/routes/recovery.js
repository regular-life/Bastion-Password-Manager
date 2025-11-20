import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

const RECOVERY_REQUEST_EXPIRY_HOURS = 48; // 48 hours to approve recovery request

/**
 * POST /api/recovery/initiate (UNAUTHENTICATED)
 * Initiate recovery by email - returns list of trusted contacts
 */
router.post('/initiate', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Find user by email
        const userResult = await pool.query(
            'SELECT id, email FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            // Don't reveal if user exists
            return res.json({ message: 'If this email has recovery set up, trusted contacts have been notified.' });
        }

        const userId = userResult.rows[0].id;

        // Get trusted contacts
        const contactsResult = await pool.query(
            `SELECT rc.id, rc.trusted_contact_id, u.email
       FROM recovery_contacts rc
       JOIN users u ON rc.trusted_contact_id = u.id
       WHERE rc.owner_id = $1 AND rc.is_active = true`,
            [userId]
        );

        if (contactsResult.rows.length === 0) {
            return res.json({ message: 'No recovery contacts found. Please contact support.' });
        }

        // Return masked contact emails for user to select
        const contacts = contactsResult.rows.map(c => ({
            id: c.id,
            email: c.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
        }));

        res.json({
            userId,
            contacts,
            message: 'Select a trusted contact to send recovery request',
        });
    } catch (error) {
        console.error('Initiate recovery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/recovery/request-unauthenticated
 * Create recovery request without authentication
 */
router.post('/request-unauthenticated', async (req, res) => {
    try {
        const { userId, recoveryContactId } = req.body;

        if (!userId || !recoveryContactId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify recovery contact exists
        const contactResult = await pool.query(
            `SELECT id, owner_id, trusted_contact_id
       FROM recovery_contacts
       WHERE id = $1 AND owner_id = $2 AND is_active = true`,
            [recoveryContactId, userId]
        );

        if (contactResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid recovery contact' });
        }

        const contact = contactResult.rows[0];
        const expiresAt = new Date(Date.now() + RECOVERY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

        // Create recovery request
        const result = await pool.query(
            `INSERT INTO recovery_requests (requester_id, trusted_contact_id, recovery_contact_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
            [userId, contact.trusted_contact_id, recoveryContactId, expiresAt]
        );

        res.json({
            requestId: result.rows[0].id,
            message: 'Recovery request sent. Please wait for your trusted contact to approve.',
            createdAt: result.rows[0].created_at,
            expiresAt,
        });
    } catch (error) {
        console.error('Request recovery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/check-status-unauthenticated/:requestId
 * Check recovery request status without authentication
 */
router.get('/check-status-unauthenticated/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await pool.query(
            `SELECT rr.id, rr.status, rr.encrypted_master_key_for_requester, 
              rr.encrypted_master_key_nonce, rr.approved_at, rr.expires_at,
              rr.requester_id
       FROM recovery_requests rr
       WHERE rr.id = $1`,
            [requestId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recovery request not found' });
        }

        const request = result.rows[0];

        // Check if expired
        if (new Date() > new Date(request.expires_at)) {
            return res.json({
                status: 'expired',
                message: 'Recovery request has expired',
            });
        }

        res.json({
            status: request.status,
            approved_at: request.approved_at,
            expires_at: request.expires_at,
            encrypted_master_key_for_requester: request.encrypted_master_key_for_requester,
            encrypted_master_key_nonce: request.encrypted_master_key_nonce,
            requester_id: request.requester_id,
        });
    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/recovery/complete-recovery (UNAUTHENTICATED)
 * Complete recovery by setting a new password with the recovered master key
 */
router.post('/complete-recovery', async (req, res) => {
    try {
        const { requestId, newPasswordHash, newSalt } = req.body;

        if (!requestId || !newPasswordHash || !newSalt) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get the recovery request
            const requestResult = await client.query(
                `SELECT rr.id, rr.requester_id, rr.status, rr.encrypted_master_key_for_requester,
                        rr.encrypted_master_key_nonce, rr.expires_at
                 FROM recovery_requests rr
                 WHERE rr.id = $1`,
                [requestId]
            );

            if (requestResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Recovery request not found' });
            }

            const request = requestResult.rows[0];

            if (request.status !== 'approved') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Recovery request not approved' });
            }

            if (new Date() > new Date(request.expires_at)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Recovery request has expired' });
            }

            // Update user's password hash and salt
            await client.query(
                'UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3',
                [newPasswordHash, Buffer.from(newSalt, 'base64'), request.requester_id]
            );

            // Mark recovery request as completed
            await client.query(
                'UPDATE recovery_requests SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['completed', requestId]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Password reset successful. You can now log in with your new password.'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Complete recovery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// All other recovery routes require authentication
router.use(requireAuth);

/**
 * POST /api/recovery/setup-keypair
 * Initialize user's recovery keypair (stores encrypted private key)
 */
router.post('/setup-keypair', async (req, res) => {
    try {
        const { publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce } = req.body;

        if (!publicKey || !encryptedPrivateKey || !encryptedPrivateKeyNonce) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if user already has a keypair
        const existing = await pool.query(
            'SELECT id FROM user_recovery_keys WHERE user_id = $1',
            [req.userId]
        );

        if (existing.rows.length > 0) {
            // Update existing keypair
            await pool.query(
                `UPDATE user_recovery_keys 
         SET public_key = $1, encrypted_private_key = $2, encrypted_private_key_nonce = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4`,
                [publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce, req.userId]
            );
        } else {
            // Create new keypair
            await pool.query(
                `INSERT INTO user_recovery_keys (user_id, public_key, encrypted_private_key, encrypted_private_key_nonce)
         VALUES ($1, $2, $3, $4)`,
                [req.userId, publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Setup keypair error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/keypair
 * Get user's recovery keypair info (public key and encrypted private key)
 */
router.get('/keypair', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT public_key, encrypted_private_key, encrypted_private_key_nonce FROM user_recovery_keys WHERE user_id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No recovery keypair found' });
        }

        res.json({
            publicKey: result.rows[0].public_key,
            encryptedPrivateKey: result.rows[0].encrypted_private_key,
            encryptedPrivateKeyNonce: result.rows[0].encrypted_private_key_nonce,
        });
    } catch (error) {
        console.error('Get keypair error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/recovery/add-trusted-contact
 * Set up a trusted contact for recovery
 */
router.post('/add-trusted-contact', async (req, res) => {
    try {
        const { trustedContactId, encryptedMasterKey } = req.body;

        if (!trustedContactId || !encryptedMasterKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Prevent users from adding themselves as trusted contact
        if (trustedContactId === req.userId) {
            return res.status(400).json({ error: 'Cannot add yourself as a trusted contact' });
        }

        // Verify trusted contact exists and has a public key
        const contactCheck = await pool.query(
            'SELECT id FROM user_recovery_keys WHERE user_id = $1',
            [trustedContactId]
        );

        if (contactCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Trusted contact has not set up recovery keys' });
        }

        // Check if contact is in same family
        const familyCheck = await pool.query(
            `SELECT f.id FROM families f
       JOIN family_members fm1 ON f.id = fm1.family_id
       JOIN family_members fm2 ON f.id = fm2.family_id
       WHERE fm1.user_id = $1 AND fm2.user_id = $2`,
            [req.userId, trustedContactId]
        );

        if (familyCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Trusted contact must be in your family' });
        }

        // Add or update recovery contact
        await pool.query(
            `INSERT INTO recovery_contacts (owner_id, trusted_contact_id, encrypted_master_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, trusted_contact_id)
       DO UPDATE SET encrypted_master_key = $3, is_active = true, updated_at = CURRENT_TIMESTAMP`,
            [req.userId, trustedContactId, encryptedMasterKey]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Add trusted contact error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/trusted-contacts
 * Get list of trusted contacts
 */
router.get('/trusted-contacts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rc.id, rc.trusted_contact_id, u.email, rc.is_active, rc.created_at
       FROM recovery_contacts rc
       JOIN users u ON rc.trusted_contact_id = u.id
       WHERE rc.owner_id = $1 AND rc.is_active = true
       ORDER BY rc.created_at DESC`,
            [req.userId]
        );

        res.json({ contacts: result.rows });
    } catch (error) {
        console.error('Get trusted contacts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/recovery/request
 * Request account recovery from a trusted contact
 */
router.post('/request', async (req, res) => {
    try {
        const { trustedContactId } = req.body;

        if (!trustedContactId) {
            return res.status(400).json({ error: 'Trusted contact ID required' });
        }

        // Verify recovery contact exists and is active
        const contactResult = await pool.query(
            `SELECT id FROM recovery_contacts 
       WHERE owner_id = $1 AND trusted_contact_id = $2 AND is_active = true`,
            [req.userId, trustedContactId]
        );

        if (contactResult.rows.length === 0) {
            return res.status(404).json({ error: 'No active recovery contact found' });
        }

        const recoveryContactId = contactResult.rows[0].id;
        const expiresAt = new Date(Date.now() + RECOVERY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

        // Create recovery request
        const result = await pool.query(
            `INSERT INTO recovery_requests (requester_id, trusted_contact_id, recovery_contact_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
            [req.userId, trustedContactId, recoveryContactId, expiresAt]
        );

        res.json({
            requestId: result.rows[0].id,
            createdAt: result.rows[0].created_at,
            expiresAt,
        });
    } catch (error) {
        console.error('Request recovery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/pending-requests
 * Get pending recovery requests where user is the trusted contact
 */
router.get('/pending-requests', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT rr.id, rr.requester_id, u.email as requester_email, rr.created_at, rr.expires_at
       FROM recovery_requests rr
       JOIN users u ON rr.requester_id = u.id
       WHERE rr.trusted_contact_id = $1 AND rr.status = 'pending' AND rr.expires_at > NOW()
       ORDER BY rr.created_at DESC`,
            [req.userId]
        );

        res.json({ requests: result.rows });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/request-data/:requestId
 * Get the encrypted master key for a recovery request (for trusted contact to decrypt)
 */
router.get('/request-data/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        // Verify request exists and user is the trusted contact
        const requestResult = await pool.query(
            `SELECT rr.id, rr.requester_id, rr.recovery_contact_id, rr.status, rr.expires_at
       FROM recovery_requests rr
       WHERE rr.id = $1 AND rr.trusted_contact_id = $2`,
            [requestId, req.userId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recovery request not found' });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }

        if (new Date() > new Date(request.expires_at)) {
            return res.status(400).json({ error: 'Request has expired' });
        }

        // Get the recovery contact record to get the encrypted master key
        const contactResult = await pool.query(
            'SELECT encrypted_master_key FROM recovery_contacts WHERE id = $1',
            [request.recovery_contact_id]
        );

        if (contactResult.rows.length === 0) {
            return res.status(404).json({ error: 'Recovery contact not found' });
        }

        res.json({
            encryptedMasterKey: contactResult.rows[0].encrypted_master_key,
        });
    } catch (error) {
        console.error('Get request data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/recovery/approve
 * Approve a recovery request and re-encrypt master key for requester
 */
router.post('/approve', async (req, res) => {
    try {
        const { requestId, encryptedMasterKeyForRequester, encryptedMasterKeyNonce } = req.body;

        if (!requestId || !encryptedMasterKeyForRequester || !encryptedMasterKeyNonce) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Verify request exists and user is the trusted contact
            const requestResult = await client.query(
                `SELECT rr.id, rr.requester_id, rr.status, rr.expires_at
         FROM recovery_requests rr
         WHERE rr.id = $1 AND rr.trusted_contact_id = $2`,
                [requestId, req.userId]
            );

            if (requestResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Recovery request not found' });
            }

            const request = requestResult.rows[0];

            if (request.status !== 'pending') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Request already processed' });
            }

            if (new Date() > new Date(request.expires_at)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Request has expired' });
            }

            // Update request with approved status and encrypted master key
            await client.query(
                `UPDATE recovery_requests 
         SET status = 'approved', 
             encrypted_master_key_for_requester = $1,
             encrypted_master_key_nonce = $2,
             approved_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
                [encryptedMasterKeyForRequester, encryptedMasterKeyNonce, requestId]
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
        console.error('Approve recovery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/request-status/:requestId
 * Check status of a recovery request
 */
router.get('/request-status/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await pool.query(
            `SELECT rr.id, rr.status, rr.encrypted_master_key_for_requester, 
              rr.encrypted_master_key_nonce, rr.approved_at, rr.expires_at
       FROM recovery_requests rr
       WHERE rr.id = $1 AND rr.requester_id = $2`,
            [requestId, req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recovery request not found' });
        }

        res.json({ request: result.rows[0] });
    } catch (error) {
        console.error('Get request status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/recovery/trusted-contact/:contactId
 * Remove a trusted contact
 */
router.delete('/trusted-contact/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;

        await pool.query(
            'UPDATE recovery_contacts SET is_active = false WHERE id = $1 AND owner_id = $2',
            [contactId, req.userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove trusted contact error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/recovery/user-public-key/:userId
 * Get public key for a specific user (for encrypting recovery data)
 */
router.get('/user-public-key/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify users are in same family
        const familyCheck = await pool.query(
            `SELECT f.id FROM families f
       JOIN family_members fm1 ON f.id = fm1.family_id
       JOIN family_members fm2 ON f.id = fm2.family_id
       WHERE fm1.user_id = $1 AND fm2.user_id = $2`,
            [req.userId, userId]
        );

        if (familyCheck.rows.length === 0) {
            return res.status(403).json({ error: 'User must be in your family' });
        }

        const result = await pool.query(
            'SELECT public_key FROM user_recovery_keys WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User has not set up recovery keys' });
        }

        res.json({ publicKey: result.rows[0].public_key });
    } catch (error) {
        console.error('Get user public key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
