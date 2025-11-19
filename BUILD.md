# Building Secure Vault

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- For Windows builds: Windows machine or Wine on Linux/Mac
- For code signing: Code signing certificate

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment:
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize database:
```bash
createdb secure_vault
```

4. Start development servers:
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Terminal 3: Electron
npm run dev:electron
```

## Building for Production

### Frontend Build

```bash
cd frontend
npm run build
```

This creates a production build in `frontend/dist/`.

### Electron Packaging

#### Windows (.exe installer)

```bash
cd electron
npm run build:win
```

Output: `electron/dist/Secure Vault Setup 1.0.0.exe`

**Code Signing** (recommended for production):

1. Obtain a code signing certificate
2. Set environment variables:
```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your-password
```

3. Build:
```bash
npm run build:win
```

#### macOS (.dmg)

```bash
cd electron
npm run build:mac
```

Output: `electron/dist/Secure Vault-1.0.0.dmg`

**Code Signing** (required for macOS):

1. Obtain Apple Developer certificate
2. Set environment variables:
```bash
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=your-team-id
```

3. Build and notarize:
```bash
npm run build:mac
```

#### Linux (.AppImage, .deb)

```bash
cd electron
npm run build:linux
```

Output:
- `electron/dist/Secure Vault-1.0.0.AppImage`
- `electron/dist/secure-vault_1.0.0_amd64.deb`

### Browser Extension Build

```bash
npm run build:extension
```

Output: `extension/` directory ready to be loaded as unpacked extension.

For distribution:
1. Zip the extension directory
2. Upload to Chrome Web Store / Firefox Add-ons
3. Submit for review

## Build Configuration

### Electron Builder

Configuration is in `electron/electron-builder.json`:

- **appId**: Unique app identifier
- **productName**: Display name
- **win/mac/linux**: Platform-specific settings
- **nsis**: Windows installer options
- **dmg**: macOS disk image options

### Code Signing Certificates

**Windows:**
- Get from: SSL.com, DigiCert, Sectigo
- Format: .pfx or .p12
- Cost: ~$100-400/year

**macOS:**
- Get from: Apple Developer Program
- Format: Certificate in Keychain
- Cost: $99/year

**Why sign:**
- Windows SmartScreen won't block
- macOS Gatekeeper allows opening
- Users trust the app
- Required for auto-updates

## Distribution

### Direct Download

Host the installers on your website:

```
https://example.com/downloads/
  - SecureVault-Setup-1.0.0.exe (Windows)
  - SecureVault-1.0.0.dmg (macOS)
  - SecureVault-1.0.0.AppImage (Linux)
```

### Package Managers

**Windows - Chocolatey:**
```bash
choco pack
choco push secure-vault.1.0.0.nupkg --api-key=YOUR_KEY
```

**macOS - Homebrew:**
```ruby
cask "secure-vault" do
  version "1.0.0"
  url "https://example.com/SecureVault-1.0.0.dmg"
  # ...
end
```

**Linux - Snap Store:**
```bash
snapcraft
snapcraft push secure-vault_1.0.0_amd64.snap
```

### Auto-Updates

Electron supports auto-updates via electron-updater.

1. Host update files on server
2. Add update check to Electron main process
3. Configure `publish` in electron-builder.json:

```json
{
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "secure-vault"
  }
}
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: cd frontend && npm run build
      - run: cd electron && npm run build
      - uses: actions/upload-artifact@v2
        with:
          name: ${{ matrix.os }}-installer
          path: electron/dist/*
```

## Testing Builds

### Windows

```bash
# Install
./electron/dist/Secure\ Vault\ Setup\ 1.0.0.exe

# Test
"C:\Program Files\Secure Vault\Secure Vault.exe"
```

### macOS

```bash
# Open DMG
open electron/dist/Secure\ Vault-1.0.0.dmg

# Drag to Applications and test
open /Applications/Secure\ Vault.app
```

### Linux

```bash
# Make executable
chmod +x electron/dist/Secure\ Vault-1.0.0.AppImage

# Run
./electron/dist/Secure\ Vault-1.0.0.AppImage
```

## Troubleshooting

### Build fails on Windows

- Ensure Node.js is added to PATH
- Run as Administrator if permission errors
- Install Windows Build Tools: `npm install --global windows-build-tools`

### macOS signing fails

- Verify certificate in Keychain Access
- Check Apple ID password is app-specific password
- Enable "Allow apps downloaded from: Anywhere" during testing

### Linux AppImage won't run

- Install FUSE: `sudo apt install fuse`
- Or extract and run directly: `./app.AppImage --appimage-extract`

## File Size Optimization

Reduce installer size:

1. Enable asar archiving (electron-builder does this by default)
2. Exclude unnecessary files in `files` array
3. Use `asarUnpack` for native modules
4. Compress installers (NSIS has built-in compression)

Typical sizes:
- Windows: 80-120 MB
- macOS: 100-150 MB
- Linux AppImage: 90-130 MB

## Security Considerations

- Always sign releases
- Use HTTPS for downloads
- Provide SHA256 checksums
- Enable security features in Electron:
  - nodeIntegration: false
  - contextIsolation: true
  - sandbox: true

## Support

For build issues, check:
- electron-builder documentation
- GitHub Issues
- Community forums
