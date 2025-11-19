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

CREATE INDEX IF NOT EXISTS idx_family_keys_family_id ON family_keys(family_id);
CREATE INDEX IF NOT EXISTS idx_family_keys_user_id ON family_keys(user_id);
