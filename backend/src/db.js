import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    // Read and execute schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vault_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_entry_key TEXT NOT NULL,
        encrypted_entry_key_nonce TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        encrypted_data_nonce TEXT NOT NULL,
        encrypted_url TEXT,
        encrypted_url_nonce TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_vault_entries_user_id ON vault_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

      -- Family sharing tables
      CREATE TABLE IF NOT EXISTS families (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS family_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS family_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_family_key TEXT NOT NULL,
        encrypted_family_key_nonce TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS family_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        used_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shared_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        vault_entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_content_key TEXT NOT NULL,
        encrypted_content_key_nonce TEXT NOT NULL,
        encrypted_credential TEXT NOT NULL,
        encrypted_credential_nonce TEXT NOT NULL,
        encrypted_url TEXT,
        encrypted_url_nonce TEXT,
        allowed_domains JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(family_id, vault_entry_id)
      );

      CREATE TABLE IF NOT EXISTS fill_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token TEXT UNIQUE NOT NULL,
        shared_credential_id UUID NOT NULL REFERENCES shared_credentials(id) ON DELETE CASCADE,
        member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ephemeral_key_encrypted TEXT NOT NULL,
        ephemeral_key_nonce TEXT NOT NULL,
        allowed_origin TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
        shared_credential_id UUID REFERENCES shared_credentials(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        origin TEXT,
        success BOOLEAN NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_families_owner_id ON families(owner_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_family_invites_token ON family_invites(token);
      CREATE INDEX IF NOT EXISTS idx_shared_credentials_family_id ON shared_credentials(family_id);
      CREATE INDEX IF NOT EXISTS idx_shared_credentials_vault_entry_id ON shared_credentials(vault_entry_id);
      CREATE INDEX IF NOT EXISTS idx_fill_tokens_token ON fill_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_audit_log_family_id ON audit_log(family_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);

      -- Recovery tables for Trusted Contact Escrow
      CREATE TABLE IF NOT EXISTS user_recovery_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        encrypted_private_key_nonce TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recovery_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trusted_contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_master_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_id, trusted_contact_id)
      );

      CREATE TABLE IF NOT EXISTS recovery_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trusted_contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recovery_contact_id UUID NOT NULL REFERENCES recovery_contacts(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        encrypted_master_key_for_requester TEXT,
        encrypted_master_key_nonce TEXT,
        approved_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        session_public_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_user_recovery_keys_user_id ON user_recovery_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_contacts_owner ON recovery_contacts(owner_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_contacts_trusted ON recovery_contacts(trusted_contact_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_requests_requester ON recovery_requests(requester_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_requests_contact ON recovery_requests(trusted_contact_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_requests_status ON recovery_requests(status);
    `);

    // Migration to relax constraints on shared_credentials
    try {
      await client.query('ALTER TABLE shared_credentials ALTER COLUMN encrypted_url DROP NOT NULL');
      await client.query('ALTER TABLE shared_credentials ALTER COLUMN encrypted_url_nonce DROP NOT NULL');
    } catch (err) {
      // Ignore errors
    }

    // Migration to add session_public_key to recovery_requests
    try {
      await client.query('ALTER TABLE recovery_requests ADD COLUMN IF NOT EXISTS session_public_key TEXT');
    } catch (err) {
      console.error('Migration error:', err);
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}
