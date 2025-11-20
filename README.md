# Bastion Password Manager

A secure, zero-knowledge, end-to-end encrypted password manager with desktop application, browser extension, and family sharing capabilities.

## Overview

Bastion is a privacy-focused password manager that ensures your master key never leaves your device. It features secure credential sharing with family members, smart password generation, and comprehensive audit logging.

### Key Features

- **🔒 Zero-Knowledge Encryption**: Your master key never touches our servers
- **👨‍👩‍👧‍👦 Family Sharing**: Securely share credentials without exposing passwords
- **🔑 Smart Password Generator**: Auto-detects site requirements and generates compliant passwords
- **🌐 Browser Extension**: Seamless autofill for Chrome, Edge, and Firefox
- **💻 Cross-Platform Desktop App**: Windows, macOS, and Linux support
- **🔄 Account Recovery**: Secure recovery through trusted contacts
- **📊 Audit Logging**: Track all credential access and sharing activity

## Architecture

### Technology Stack

- **Frontend**: React + Vite
- **Desktop**: Electron
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Cryptography**: libsodium (XChaCha20-Poly1305) + Argon2id
- **Extension**: Manifest v3

### Security Model

#### Encryption Architecture

1. **Master Key Derivation**
   - User's master password is hashed with Argon2id using a unique salt
   - Master key derived locally from password + salt
   - Only password hash sent to server for authentication
   - Master key **never transmitted**

2. **Vault Entry Encryption**
   - Each entry has its own random encryption key
   - Entry data encrypted with entry key
   - Entry key encrypted with master key
   - Only ciphertexts stored on server

3. **Family Sharing Security**
   - Shared credentials use content keys (K_cred)
   - Members receive time-limited delegation tokens (30 seconds)
   - Passwords autofilled without viewing plaintext
   - Single-use tokens bound to specific origins
   - Complete audit trail

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **Git** (for cloning)
- Chrome/Edge browser (for extension)

### Installation

#### 1. Clone and Install

```bash
git clone https://github.com/arnavjindal/Bastion-Password-Manager.git
cd Bastion-Password-Manager
npm install
```

#### 2. Setup Database

```bash
# Create PostgreSQL database
createdb bastion

# Configure backend (edit if needed)
cd backend
cp .env.example .env
```

#### 3. Start Development Environment

Open three terminal windows:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

**Terminal 3 - Desktop App:**
```bash
npm run dev:electron
```

#### 4. Build Browser Extension

```bash
npm run build:extension
```

Then load in browser:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` directory

## Production Deployment

### Backend Deployment (VM/Server)

The backend is designed to run on a remote server or VM:

```bash
# On your server (e.g., ssh user4@192.168.2.246)
cd Bastion-Password-Manager/backend

# Configure environment
cp .env.example .env
nano .env  # Edit DATABASE_URL and other settings

# Start production server
npm run start

# Or use a process manager like PM2
pm2 start src/server.js --name bastion-backend
pm2 save
pm2 startup
```

**Environment Variables (.env):**
```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/bastion
NODE_ENV=production
SESSION_DURATION_HOURS=24
```

### Desktop App Distribution (.exe)

Build standalone installers for end-users:

#### Windows (.exe)

```bash
cd electron
npm run build:win
```

Output: `electron/dist/Bastion Setup 1.0.0.exe`

#### macOS (.dmg)

```bash
cd electron
npm run build:mac
```

Output: `electron/dist/Bastion-1.0.0.dmg`

#### Linux (.AppImage)

```bash
cd electron
npm run build:linux
```

Output: `electron/dist/Bastion-1.0.0.AppImage`

### Configure Remote Backend

When building the desktop app to connect to your remote backend:

```bash
# Set API URL before building
VITE_API_URL=https://your-backend-domain.com npm run build:electron
# or for IP address
VITE_API_URL=http://192.168.2.246:3001 npm run build:electron
```

## Project Structure

```
Bastion-Password-Manager/
├── backend/              # Express API server
│   ├── src/
│   │   ├── server.js          # Main server entry point
│   │   ├── db.js              # Database connection
│   │   ├── auth.js            # Session management
│   │   └── routes/            # API endpoints
│   ├── schema.sql             # Database schema
│   └── .env                   # Configuration
│
├── frontend/             # React UI
│   └── src/
│       ├── App.jsx            # Main application
│       ├── components/        # React components
│       ├── crypto.js          # Client-side crypto
│       └── api.js             # API client
│
├── electron/             # Desktop wrapper
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script
│   └── electron-builder.json # Build configuration
│
├── extension/            # Browser extension
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # Service worker
│   ├── content.js            # Content script
│   └── popup.html            # Extension popup
│
├── shared/               # Shared utilities
│   ├── crypto.js             # Crypto functions
│   └── crypto.test.js        # Crypto tests
│
└── scripts/              # Build and setup scripts
    ├── setup.js
    └── clean.js
```

## Available Commands

### Development

```bash
npm run setup              # First-time setup (installs deps, creates DB)
npm run dev:backend        # Start backend server (port 3001)
npm run dev:frontend       # Start frontend dev server (port 5173)
npm run dev:electron       # Launch Electron desktop app
npm run build:extension    # Build browser extension
```

### Production

```bash
npm run build:frontend     # Build frontend for production
npm run build:electron     # Build desktop app (.exe, .dmg, .AppImage)
npm run start:backend      # Start backend in production mode
```

### Maintenance

```bash
npm run clean             # Remove all build artifacts and node_modules
npm test                  # Run all tests
```

## Configuration

### Backend Configuration

Edit `backend/.env`:

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Sessions
SESSION_DURATION_HOURS=24

# Optional: CORS
ALLOWED_ORIGINS=https://your-domain.com
```

### Frontend Configuration

When building for production, configure API endpoint:

```bash
# In electron or frontend directory
echo "VITE_API_URL=https://api.yourdomain.com" > .env.local
```

## Security Features

### What's Protected

✅ Master key never transmitted to server  
✅ All vault entries encrypted before upload  
✅ Per-entry random encryption keys  
✅ Argon2id password hashing (memory-hard KDF)  
✅ Authenticated encryption (XChaCha20-Poly1305)  
✅ Memory cleared after use  
✅ Time-limited delegation tokens for family sharing  

### Attack Resistance

- **Server Breach**: Server only has ciphertexts, cannot decrypt
- **Network Interception**: Only encrypted data transmitted
- **Password Cracking**: Argon2id makes brute force extremely expensive
- **Replay Attacks**: Each encryption uses unique random nonce
- **Family Member Compromise**: Members can't view shared passwords

### Known Limitations

⚠️ No protection against compromised desktop app  
⚠️ Extension trusts desktop app via native messaging  
⚠️ No protection if master password is weak  
⚠️ Memory dumps could expose keys while vault is unlocked  

## Testing

### Run Tests

```bash
# All tests
npm test

# Crypto tests only
npm test --workspace=shared

# Backend tests only
npm test --workspace=backend
```

### Manual Testing

1. **Create Account**: Sign up → Enter credentials → Verify vault created
2. **Add Credential**: Add entry → Check database shows only ciphertext
3. **Autofill**: Navigate to site → Extension autofills → Verify correct credentials
4. **Family Sharing**: Create family → Share credential → Member autofills without viewing password
5. **Account Recovery**: Setup trusted contact → Initiate recovery → Approve → Complete with new password

## Troubleshooting

### Database Connection Error

```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -l | grep bastion

# Create if missing
createdb bastion

# Test connection
psql bastion
```

### Extension Can't Connect to Desktop App

1. Ensure desktop app is running and logged in
2. Check extension ID matches in `electron/main.js`
3. Reload extension in `chrome://extensions/`

### Port Already in Use

```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
kill $(lsof -ti:3001)

# Or change port in backend/.env
PORT=3002
```

### Build Fails

```bash
# Clean everything
npm run clean

# Reinstall
npm install

# Try building again
npm run build:electron
```

## Documentation

- **User Guide**: See [User-Guide.md](User-Guide.md) for detailed end-user instructions
- **API Documentation**: See backend route files for API endpoints
- **Security Details**: See `Architecture > Security Model` above

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues or questions:
- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check this README and User-Guide.md
- **Email**: support@bastion-pm.example.com (update with actual email)

## License

MIT License - See [LICENSE.txt](LICENSE.txt) for details

## Acknowledgments

- **libsodium**: Modern cryptographic library
- **Argon2**: Password hashing algorithm
- **Electron**: Cross-platform desktop framework
- **React**: UI framework

---

**Built with ❤️ for security and privacy**
