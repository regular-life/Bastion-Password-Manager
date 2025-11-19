-- Family sharing extension schema

-- Families table
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner' or 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, user_id)
);

-- Family keys table
-- Each family member has the family's shared key encrypted with their own master key
CREATE TABLE IF NOT EXISTS family_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_family_key TEXT NOT NULL,
  encrypted_family_key_nonce TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, user_id)
);

-- Invite tokens table
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

-- Shared credentials table
CREATE TABLE IF NOT EXISTS shared_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  vault_entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Content key encrypted with owner's master key for auditing
  encrypted_content_key TEXT NOT NULL,
  encrypted_content_key_nonce TEXT NOT NULL,
  -- Credential data encrypted with content key (optional - we just reference vault_entry)
  encrypted_credential TEXT,
  encrypted_credential_nonce TEXT,
  -- URL for matching (encrypted with content key) (optional - we just reference vault_entry)
  encrypted_url TEXT,
  encrypted_url_nonce TEXT,
  -- Allowed domains for autofill (JSON array)
  allowed_domains JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family_id, vault_entry_id)
);

-- Fill tokens table (short-lived, single-use)
CREATE TABLE IF NOT EXISTS fill_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  shared_credential_id UUID NOT NULL REFERENCES shared_credentials(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Ephemeral key for this token (encrypted)
  ephemeral_key_encrypted TEXT NOT NULL,
  ephemeral_key_nonce TEXT NOT NULL,
  -- Policy
  allowed_origin TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  shared_credential_id UUID REFERENCES shared_credentials(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'autofill', 'share', 'unshare', 'revoke', 'rotate', 'invite', 'join'
  origin TEXT,
  success BOOLEAN NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_families_owner_id ON families(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_keys_family_id ON family_keys(family_id);
CREATE INDEX IF NOT EXISTS idx_family_keys_user_id ON family_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_token ON family_invites(token);
CREATE INDEX IF NOT EXISTS idx_shared_credentials_family_id ON shared_credentials(family_id);
CREATE INDEX IF NOT EXISTS idx_shared_credentials_vault_entry_id ON shared_credentials(vault_entry_id);
CREATE INDEX IF NOT EXISTS idx_fill_tokens_token ON fill_tokens(token);
CREATE INDEX IF NOT EXISTS idx_audit_log_family_id ON audit_log(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
