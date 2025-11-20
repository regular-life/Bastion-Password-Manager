#!/bin/bash

# Bastion Development Environment Setup Script
# This script sets up the development environment for Bastion Password Manager

set -e

echo "🚀 Bastion Password Manager - Development Setup"
echo "================================================"
echo ""

# Check Node.js
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old (need 18+, have $(node -v))"
    exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed!"
    echo "   Please install PostgreSQL 14+ from https://www.postgresql.org/"
    exit 1
fi
echo "  ✓ PostgreSQL installed"

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🗄️  Setting up database..."

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw bastion; then
    echo "  ✓ Database 'bastion' already exists"
else
    echo "  Creating database 'bastion'..."
    createdb bastion
    echo "  ✓ Database created"
fi

# Apply schema
echo "  Applying database schema..."
if [ -f "backend/schema.sql" ]; then
    psql bastion < backend/schema.sql > /dev/null 2>&1 || echo "  (Schema may already be applied)"
fi
if [ -f "backend/schema-family.sql" ]; then
    psql bastion < backend/schema-family.sql > /dev/null 2>&1 || echo "  (Family schema may already be applied)"
fi
echo "  ✓ Database schema ready"

# Setup backend .env
echo ""
echo "⚙️  Configuring backend..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "  ✓ Created backend/.env from example"
        echo "  ⚠️  You may want to edit backend/.env if needed"
    else
        cat > backend/.env << 'EOF'
PORT=3001
DATABASE_URL=postgresql://localhost:5432/bastion
NODE_ENV=development
SESSION_DURATION_HOURS=24
EOF
        echo "  ✓ Created default backend/.env"
    fi
else
    echo "  ✓ backend/.env already exists"
fi

# Build extension
echo ""
echo "🧩 Building browser extension..."
npm run build:extension
echo "  ✓ Extension built"

echo ""
echo "✅ Setup Complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Next Steps:"
echo ""
echo "1. Start the backend server:"
echo "   npm run dev:backend"
echo ""
echo "2. Start the frontend (in a new terminal):"
echo "   npm run dev:frontend"
echo ""
echo "3. Start the desktop app (in a new terminal):"
echo "   npm run dev:electron"
echo ""
echo "4. Load browser extension (optional):"
echo "   • Open Chrome/Edge"
echo "   • Go to chrome://extensions/"
echo "   • Enable 'Developer mode'"
echo "   • Click 'Load unpacked'"
echo "   • Select the 'extension' directory"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation:"
echo "  • README.md - Technical documentation & architecture"
echo "  • User-Guide.md - End-user guide for using Bastion"
echo ""
echo "🔧 Useful Commands:"
echo "  npm run dev:backend    - Start backend server"
echo "  npm run dev:frontend   - Start frontend dev server"
echo "  npm run dev:electron   - Launch desktop app"
echo "  npm run build:electron - Build .exe/.dmg/.AppImage"
echo "  npm test               - Run tests"
echo ""
echo "🚀 Happy secure password managing!"
