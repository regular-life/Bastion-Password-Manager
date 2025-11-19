# Family Sharing Guide

## Overview

Family sharing allows you to securely share credentials with family members without revealing the actual passwords. Members can autofill shared credentials but cannot view them in plaintext.

## Concepts

### Roles

- **Owner**: The person who creates the family and shares credentials. Has full control.
- **Member**: Someone invited to the family. Can use shared credentials but cannot view passwords.

### Security Architecture

#### Content Keys (K_cred)

Each shared credential has its own random content key. This key encrypts the actual credential data.

```
Credential → Encrypt with K_cred → Ciphertext (stored on server)
K_cred → Encrypt with Owner's Master Key → Encrypted K_cred (stored on server)
```

#### Delegation Tokens

When a member needs to autofill:

1. **Request**: Member requests a fill token for specific origin
2. **Validation**: Server checks:
   - Is user a member of the family?
   - Is origin allowed for this credential?
   - Is credential still shared (not revoked)?
3. **Token Generation**: Server creates:
   - Ephemeral key (random, one-time)
   - Fill token (signed, expires in 30 seconds)
   - Single-use flag
4. **Autofill**: Member receives:
   - Encrypted credential
   - Ephemeral key to decrypt it
   - Fill token
5. **Usage**:
   - Decrypt credential in memory
   - Fill form fields
   - Immediately clear from memory
   - Mark token as used

### Security Properties

- **No Password Viewing**: Members never see plaintext passwords in UI
- **Ephemeral Decryption**: Credentials only decrypted in memory during fill
- **Time-Limited**: Fill tokens expire in 30 seconds
- **Single-Use**: Each token can only be used once
- **Origin-Bound**: Tokens only work on allowed domains
- **Audit Trail**: All requests logged with timestamps

## Setup

### Creating a Family

1. Log into desktop app
2. Navigate to "Families" section
3. Click "Create Family"
4. Enter family name
5. You are automatically added as owner

### Inviting Members

1. Open your family
2. Click "Create Invite Link"
3. Set expiration (default: 7 days)
4. Copy and share the link with family member
5. They click the link and accept invite

**Note**: Invite links are one-time use and expire after set time.

### Sharing a Credential

1. Go to your vault
2. Select a credential to share
3. Click "Share with Family"
4. Choose the family
5. Set allowed domains (optional)
   - Leave empty for all domains
   - Or specify: `example.com`, `app.example.com`
6. Click "Share"

The credential is now available to all family members for autofill.

## Using Shared Credentials (Members)

### Autofill Workflow

1. Navigate to a login page
2. Click extension icon
3. Click "Unlock Vault"
4. Extension detects shared credentials for this site
5. Click "Autofill Shared" button
6. Credentials are filled automatically
7. Password is cleared from memory after fill

**Important**: You cannot view the password in the extension UI. You can only autofill it.

### What Members See

- URL/site name
- Username (visible)
- Password: (masked as •••••••••)
- Domains where autofill is allowed
- Last used timestamp

### What Members Cannot Do

- View password in plaintext
- Copy password
- Edit shared credentials
- Share with others
- See owner's master key

## Owner Controls

### Viewing Shared Credentials

1. Go to "Families" → Select family
2. Click "Shared Credentials"
3. View list of all shared items
4. See which members have used each credential

### Revoking Access

To stop sharing a credential:

1. Find credential in shared list
2. Click "Unshare"
3. Confirm revocation

**Effect**: Members immediately lose access. Any pending fill tokens are invalidated.

### Rotating Keys

If you suspect a credential may be compromised:

1. Click "Rotate" on shared credential
2. System generates new K_cred
3. Re-encrypts credential with new key
4. All old fill tokens are invalidated
5. Members can continue autofilling with new token

### Removing Members

1. Go to "Family Members"
2. Select member to remove
3. Click "Remove from Family"
4. Confirm removal

**Effect**: Member loses access to all shared credentials immediately.

### Viewing Audit Logs

1. Go to "Families" → Select family
2. Click "Audit Log"
3. View recent activity:
   - Who requested autofill
   - Which credential
   - Which origin
   - Success or failure
   - Timestamp

**Retention**: Logs kept for 90 days by default.

## Advanced Configuration

### Per-Credential Domain Restrictions

When sharing, you can restrict autofill to specific domains:

```json
{
  "allowed_domains": [
    "example.com",
    "app.example.com",
    "secure.example.com"
  ]
}
```

- Exact match: `example.com` only allows `https://example.com`
- Subdomain match: Also allows `https://anything.example.com`
- Port agnostic: Works on any port

### Token Expiry Configuration

Default: 30 seconds

To change (server-side):

```javascript
// backend/src/routes/sharing.js
const FILL_TOKEN_EXPIRY_SECONDS = 60; // Increase to 60 seconds
```

**Trade-off**: Longer expiry = more time for attacker to use stolen token.

### Audit Log Retention

Default: Unlimited

To configure retention:

```sql
-- Delete logs older than 90 days
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
```

Add this as a cron job or scheduled task.

## Security Best Practices

### For Owners

1. **Trust Your Members**: Only invite people you trust
2. **Review Audit Logs**: Check regularly for suspicious activity
3. **Use Domain Restrictions**: Limit autofill to specific sites
4. **Revoke When Needed**: Remove access immediately if member leaves family
5. **Rotate Keys**: If credential may be compromised, rotate immediately
6. **Don't Share Master Password**: Never share your master password with anyone

### For Members

1. **Verify Origin**: Check you're on the correct site before autofilling
2. **Report Issues**: If autofill fails, tell family owner
3. **Secure Your Account**: Use strong master password
4. **Lock After Use**: Lock vault when not in use
5. **Don't Screenshot**: Never take screenshots of autofilled forms

## Troubleshooting

### "Fill Token Expired" Error

**Cause**: Token expired before use (>30 seconds passed)

**Fix**: Request a new token and use it immediately

### "Origin Not Allowed" Error

**Cause**: Current site not in allowed domains list

**Fix**:
1. Owner: Add the domain to allowed list
2. Or remove domain restrictions entirely

### Autofill Not Working

**Possible causes**:
1. Vault is locked → Unlock first
2. Credential was revoked → Check with owner
3. Browser extension needs update → Update extension
4. Desktop app not running → Start desktop app

**Debug steps**:
1. Check extension is connected to desktop app
2. Check family membership is active
3. Check credential is still shared
4. Check browser console for errors

### Invite Link Invalid

**Possible causes**:
1. Link expired
2. Link already used
3. Invalid token

**Fix**: Owner generates new invite link

## API Reference

### Create Family

```http
POST /api/family
Authorization: Bearer {token}

{
  "name": "Smith Family"
}
```

### Create Invite

```http
POST /api/family/{familyId}/invite
Authorization: Bearer {token}

{
  "expiresInHours": 168
}
```

### Share Credential

```http
POST /api/sharing/share
Authorization: Bearer {token}

{
  "familyId": "uuid",
  "vaultEntryId": "uuid",
  "encryptedContentKey": "base64",
  "encryptedContentKeyNonce": "base64",
  "encryptedCredential": "base64",
  "encryptedCredentialNonce": "base64",
  "encryptedUrl": "base64",
  "encryptedUrlNonce": "base64",
  "allowedDomains": ["example.com"]
}
```

### Request Fill Token

```http
POST /api/sharing/request-fill-token
Authorization: Bearer {token}

{
  "sharedCredentialId": "uuid",
  "origin": "https://example.com"
}
```

### View Audit Logs

```http
GET /api/sharing/audit/{familyId}?limit=100
Authorization: Bearer {token}
```

## Privacy & Compliance

### Data Storage

**Server stores**:
- Encrypted credentials (ciphertext only)
- Encrypted content keys
- Metadata (URLs, domains, timestamps)
- Audit logs (user IDs, timestamps, origins)

**Server NEVER stores**:
- Master passwords
- Master keys
- Plaintext credentials
- Decryption keys

### GDPR Compliance

Users can:
- Export all their data
- Delete their account and all associated data
- View audit logs of credential access
- Revoke access at any time

### Data Retention

- Active credentials: Indefinite
- Audit logs: 90 days (configurable)
- Expired tokens: Deleted after 24 hours
- Inactive accounts: Configurable retention policy

## FAQ

**Q: Can members see the password if they inspect network traffic?**

A: No. The password is only decrypted in memory using an ephemeral key. Network traffic only contains ciphertext.

**Q: What if a member's device is compromised?**

A: If their device is compromised while autofilling, an attacker could potentially capture the password during the brief moment it's in memory. However, the attacker cannot access other shared credentials without new fill tokens.

**Q: Can I share with multiple families?**

A: Not yet. A credential can only be shared with one family at a time. This is a future enhancement.

**Q: Can members share credentials they received?**

A: No. Only owners can share credentials. Members only have autofill access.

**Q: How do I know if someone used my shared credential?**

A: Check the audit logs. Every autofill request is logged with timestamp and origin.

**Q: What happens if I delete a shared credential?**

A: It's removed from the family share. Members lose access immediately. The credential remains in your personal vault.

**Q: Can I change the owner of a family?**

A: Not yet. The creator remains the owner. This is a future enhancement.

## Support

For issues or questions:
- Check the main README.md
- View BUILD.md for setup instructions
- Open an issue on GitHub
- Contact support
