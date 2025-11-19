# Quick Start Guide

Get up and running with Secure Vault in 5 minutes.

## 1. Installation (Development)

```bash
# Clone or navigate to project
cd new2

# Install all dependencies
npm install

# Set up database
createdb secure_vault

# Configure backend
cd backend
cp .env.example .env
# Edit .env if needed (default values work for local development)
```

## 2. Start the Application

Open 3 terminal windows:

### Terminal 1: Backend
```bash
npm run dev:backend
```

Wait for: "Server running on http://localhost:3001"

### Terminal 2: Frontend
```bash
npm run dev:frontend
```

Wait for: "Local: http://localhost:3000"

### Terminal 3: Electron
```bash
npm run dev:electron
```

The desktop app window should open.

## 3. Create Account

1. In the desktop app, click "Sign Up"
2. Enter your email: `test@example.com`
3. Enter a strong master password (remember this!)
4. Click "Sign Up"

You're now logged in to your vault.

## 4. Add a Credential

1. Fill out the form:
   - Website URL: `https://github.com`
   - Username: `your-username`
   - Password: `your-password`
2. Click "Add Entry"

Your credential is encrypted and saved!

## 5. Install Browser Extension

```bash
npm run build:extension
```

Then:
1. Open Chrome/Edge
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `extension` folder
6. Extension icon appears in toolbar

## 6. Test Autofill

1. Keep desktop app running and logged in
2. Navigate to a login page (e.g., GitHub)
3. Click extension icon → "Unlock Vault"
4. Look for password field
5. Click "Fill Password" button that appears
6. Credentials are filled!

## 7. Try Password Generator

1. Navigate to a sign-up page
2. Look for password field
3. Click "Generate Password" button
4. Review generated password
5. Click "Use This Password"
6. Save to vault when prompted

## 8. Set Up Family Sharing

### As Owner:

1. In desktop app, go to "Families" tab
2. Click "Create Family"
3. Name: "My Family"
4. Click "Create Invite Link"
5. Copy the link

### As Member:

1. Open the invite link in browser
2. Log in (or create account)
3. Accept invite
4. You're now a family member!

### Share a Credential:

1. Owner: Select a credential
2. Click "Share with Family"
3. Choose "My Family"
4. Add allowed domains (optional)
5. Click "Share"

### Member Autofill:

1. Member: Navigate to login page
2. Extension detects shared credential
3. Click "Autofill Shared"
4. Credentials filled (password never visible)

## Common Commands

```bash
# Development
npm run dev:backend          # Start API server
npm run dev:frontend         # Start React dev server
npm run dev:electron         # Launch desktop app

# Building
npm run build:extension      # Build extension
cd frontend && npm run build # Build frontend
cd electron && npm run build:win   # Windows installer
cd electron && npm run build:mac   # macOS installer
cd electron && npm run build:linux # Linux installer

# Testing
npm test                     # Run crypto tests
cd shared && npm test        # Run shared tests
```

## Ports

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Database**: localhost:5432

## File Locations

- **Vault data**: PostgreSQL database
- **Session data**: Database (sessions table)
- **Logs**: Console output
- **Extension**: `extension/` folder
- **Desktop app**: Electron window

## Security Notes

### Master Password

- Used to derive your master key
- Never sent to server
- Cannot be reset (by design)
- Make it strong and memorable!

### Session

- Logged in for 24 hours by default
- Stored in database
- Can log out anytime

### Extension

- Needs desktop app running
- Gets master key via native messaging
- Auto-locks after 15 minutes

## Troubleshooting

### "Cannot connect to database"

```bash
# Check PostgreSQL is running
psql -l

# Create database if missing
createdb secure_vault

# Check connection string
cat backend/.env
```

### "Extension cannot connect"

1. Ensure desktop app is running
2. Ensure you're logged in
3. Check native messaging host installed
4. Restart extension

### "Port already in use"

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill

# Or change port in backend/.env
PORT=3002
```

### "Build fails"

```bash
# Clear and reinstall
rm -rf node_modules
npm install

# Clear caches
cd frontend && rm -rf node_modules dist
cd electron && rm -rf node_modules dist
```

## Next Steps

- **Learn more**: Read [README.md](README.md)
- **Family sharing**: Read [FAMILY_SHARING.md](FAMILY_SHARING.md)
- **Build for production**: Read [BUILD.md](BUILD.md)
- **Security details**: See "Security Model" in README.md

## Example Workflow

### Daily Use

1. Start desktop app
2. Enter master password
3. Add/edit credentials as needed
4. Browse web normally
5. Extension autofills when needed
6. Lock app when done

### Sharing with Family

1. Create family
2. Invite members
3. Share specific credentials
4. Monitor audit logs
5. Revoke access if needed

### Generating Passwords

1. Visit sign-up page
2. Click "Generate Password"
3. Review requirements
4. Use generated password
5. Save to vault

## Tips

- **Backup**: Export vault regularly (feature coming)
- **Strong Password**: Use 12+ characters with mixed case, numbers, symbols
- **2FA**: Enable on your vault account (feature coming)
- **Review**: Check audit logs weekly if sharing
- **Update**: Keep extension and app updated

## Support

Having issues? Check:
1. All three services (backend, frontend, Electron) are running
2. Database is accessible
3. No port conflicts
4. Extension is loaded properly

Still stuck? Create an issue with:
- Error messages
- Steps to reproduce
- System info (OS, Node version)
- Console logs

Happy password managing! 🔒
