#!/bin/bash

echo "Setting up Secure Vault..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Set up database
echo ""
echo "Setting up database..."
echo "Creating database 'secure_vault'..."

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw secure_vault; then
    echo "Database already exists"
else
    createdb secure_vault
    echo "Database created"
fi

# Build extension
echo ""
echo "Building browser extension..."
npm run build:extension

echo ""
echo "Setup complete!"
echo ""
echo "To start the application:"
echo "  1. Start backend:    npm run dev:backend"
echo "  2. Start frontend:   npm run dev:frontend"
echo "  3. Start Electron:   npm run dev:electron"
echo ""
echo "To load the extension:"
echo "  1. Open Chrome/Edge"
echo "  2. Go to chrome://extensions/"
echo "  3. Enable 'Developer mode'"
echo "  4. Click 'Load unpacked'"
echo "  5. Select the 'extension' directory"
