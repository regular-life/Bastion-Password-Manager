# Secure Vault - Password Manager

A secure, end-to-end encrypted password manager with desktop app and browser extension.

## Features

### Core Security
- **Zero-knowledge encryption**: Master key never leaves your device
- **Argon2id key derivation**: Secure password hashing with salts
- **Per-entry encryption**: Each vault entry has its own random encryption key
- **XChaCha20-Poly1305**: Modern authenticated encryption
- **Browser autofill**: Automatic credential filling via extension
- **Native messaging**: Secure communication between extension and desktop app

### Family Sharing
- **Secure credential sharing**: Share passwords with family members without exposing plaintext
- **Delegation tokens**: Members get short-lived, single-use tokens for autofill
- **Masked autofill**: Family members can autofill credentials without viewing the password
- **Granular permissions**: Control which domains are allowed for each shared credential
- **Audit logging**: Track all autofill requests with timestamps and success/failure
- **Revocation**: Owner can instantly revoke access to shared credentials

### Smart Password Generation
- **Page scanner**: Automatically extracts password requirements from registration pages
- **NLP parser**: Understands natural language password rules
- **Constraint-aware generation**: Creates passwords that meet site-specific requirements
- **Strength scoring**: Real-time password strength calculation
- **Validation feedback**: Shows which requirements are met/missing

### Desktop App
- **Cross-platform**: Windows, macOS, and Linux support
- **Native installers**: .exe for Windows, .dmg for macOS, .AppImage for Linux
- **Auto-updates**: Built-in update mechanism
- **Code signing**: Signed installers for security

## Architecture

### Tech Stack

- **Frontend**: React with Vite
- **Desktop**: Electron wrapper
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Crypto**: libsodium (XChaCha20-Poly1305) + Argon2id
- **Extension**: Manifest v3 (Chrome/Edge/Firefox)

### Security Model

#### Personal Vault
1. **Password Derivation**: User's master password is hashed with Argon2id using a unique salt
2. **Server Authentication**: Only the password hash is sent to the server for authentication
3. **Master Key**: Derived locally from password + salt, never transmitted
4. **Entry Encryption**:
   - Generate random key for each entry
   - Encrypt entry data with entry key
   - Encrypt entry key with master key
   - Store only ciphertexts on server
5. **Extension Access**:
   - Extension gets master key from desktop app via native messaging
   - Fetches encrypted vault from server
   - Decrypts entries locally

#### Family Sharing
1. **Content Key (K_cred)**: Each shared credential has a random content key
2. **Owner Encryption**: Credential encrypted with K_cred, K_cred encrypted with owner's master key
3. **Delegation Flow** (for members):
   - Member requests fill token for specific origin
   - Server validates membership and origin
   - Server generates ephemeral key and short-lived token (30 seconds)
   - Member uses ephemeral key to decrypt credential in memory only
   - Credential filled to form, then immediately cleared
   - Token marked as used (single-use enforcement)
4. **Security Properties**:
   - Members never see plaintext passwords
   - Fill tokens expire in seconds
   - Tokens bound to specific origins
   - All access logged for audit
   - No persistent decryption keys for members

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Chrome/Edge browser (for extension)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Set up database**:
```bash
# Create database
createdb secure_vault

# Set up environment
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

3. **Start backend**:
```bash
npm run dev:backend
```

4. **Start frontend**:
```bash
npm run dev:frontend
```

5. **Start Electron app** (in another terminal):
```bash
npm run dev:electron
```

6. **Build extension**:
```bash
npm run build:extension
```

7. **Load extension**:
   - Open Chrome/Edge
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory

### Configuration

#### Backend (.env)

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/secure_vault
NODE_ENV=development
SESSION_DURATION_HOURS=24
```

## Testing

### Unit Tests

Run crypto tests:
```bash
npm test
```

### End-to-End Test

1. **Create account**:
   - Open desktop app
   - Click "Sign Up"
   - Enter email and master password
   - Account is created, vault is unlocked

2. **Add credential**:
   - Enter website URL (e.g., `https://example.com`)
   - Enter username and password
   - Click "Add Entry"
   - Entry is encrypted and stored

3. **Test autofill**:
   - Navigate to a website with login form
   - Click the extension icon
   - Click "Unlock Vault" (desktop app must be running)
   - Go to login page
   - Click "Fill Password" button that appears
   - Credentials are filled automatically

4. **Verify security**:
   - Check database: `SELECT * FROM vault_entries;`
   - Confirm only ciphertext is stored (no plaintext passwords)
   - Check no master key material in database

## Project Structure

```
.
├── backend/           # Express API server
│   ├── src/
│   │   ├── server.js       # Main server
│   │   ├── db.js           # Database setup
│   │   ├── auth.js         # Session management
│   │   └── routes/         # API routes
│   └── schema.sql     # Database schema
├── frontend/          # React UI
│   └── src/
│       ├── App.jsx         # Main app
│       ├── crypto.js       # Client crypto
│       ├── api.js          # API client
│       └── components/     # React components
├── electron/          # Electron wrapper
│   ├── main.js        # Main process
│   └── preload.js     # Preload script
├── extension/         # Browser extension
│   ├── manifest.json       # Extension manifest
│   ├── background.js       # Service worker
│   ├── content.js          # Content script
│   ├── popup.html          # Extension popup
│   └── crypto-lib.js       # Extension crypto
└── shared/            # Shared crypto utilities
    ├── crypto.js           # Crypto functions
    └── crypto.test.js      # Crypto tests
```

## Security Considerations

### What's Protected

- Master key never transmitted to server
- All vault entries encrypted before upload
- Per-entry random encryption keys
- Passwords hashed with Argon2id (memory-hard KDF)
- Authenticated encryption (XChaCha20-Poly1305)
- Memory cleared after use

### Attack Resistance

- **Server breach**: Server only has ciphertexts, cannot decrypt
- **Network interception**: Only encrypted data transmitted
- **Password cracking**: Argon2id makes brute force extremely expensive
- **Replay attacks**: Each encryption uses unique random nonce

### Limitations

- No protection against compromised desktop app
- Extension trusts desktop app via native messaging
- No protection if master password is weak
- Memory dumps could expose keys while vault is unlocked

## Development

### Adding Features

- **New API endpoints**: Add to `backend/src/routes/`
- **New UI components**: Add to `frontend/src/components/`
- **Extension features**: Modify `extension/background.js` or `extension/content.js`

### Running Tests

```bash
# Crypto tests
cd shared
npm test

# Backend tests (add as needed)
cd backend
npm test
```

## Troubleshooting

### Extension can't connect to desktop app

1. Ensure desktop app is running
2. Check native messaging manifest is installed
3. Update extension ID in `electron/main.js`

### Database connection error

1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Ensure database exists: `createdb secure_vault`

### Decryption fails

1. Ensure you're using the correct master password
2. Check that vault was encrypted with same key
3. Verify salt matches the one used during encryption

## License

MIT
