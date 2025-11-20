#!/bin/bash

# Bastion Backend Deployment Script
# This script helps deploy the backend to a VM or remote server

set -e

echo "🚀 Bastion Backend Deployment Script"
echo "======================================"
echo ""

# Configuration
DEFAULT_USER="user4"
DEFAULT_HOST="192.168.2.246"
DEFAULT_REMOTE_PATH="/home/user4/bastion-backend"

# Get deployment target
read -p "Enter SSH user [$DEFAULT_USER]: " SSH_USER
SSH_USER=${SSH_USER:-$DEFAULT_USER}

read -p "Enter SSH host [$DEFAULT_HOST]: " SSH_HOST
SSH_HOST=${SSH_HOST:-$DEFAULT_HOST}

read -p "Enter remote deployment path [$DEFAULT_REMOTE_PATH]: " REMOTE_PATH
REMOTE_PATH=${REMOTE_PATH:-$DEFAULT_REMOTE_PATH}

SSH_TARGET="$SSH_USER@$SSH_HOST"

echo ""
echo "Deployment Configuration:"
echo "  SSH Target: $SSH_TARGET"
echo "  Remote Path: $REMOTE_PATH"
echo ""

read -p "Continue with deployment? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "📦 Step 1: Creating deployment package..."

# Create temporary directory for deployment files
TEMP_DIR=$(mktemp -d)
echo "  Using temp directory: $TEMP_DIR"

# Copy backend files
cp -r backend/* "$TEMP_DIR/"

# Copy shared utilities
mkdir -p "$TEMP_DIR/shared"
cp -r shared/* "$TEMP_DIR/shared/"

# Create .env.example if it doesn't exist
if [ ! -f "$TEMP_DIR/.env.example" ]; then
    cat > "$TEMP_DIR/.env.example" << 'EOF'
PORT=3001
DATABASE_URL=postgresql://user4:password@localhost:5432/bastion
NODE_ENV=production
SESSION_DURATION_HOURS=24
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,file://*
EOF
fi

# Create deployment README
cat > "$TEMP_DIR/DEPLOY_README.md" << 'EOF'
# Bastion Backend Deployment

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your settings
   ```

3. Setup database:
   ```bash
   # Create PostgreSQL database
   createdb bastion
   
   # Run schema
   psql bastion < schema.sql
   psql bastion < schema-family.sql
   ```

4. Start server:
   ```bash
   npm start
   ```

## Using PM2 (Recommended)

Install PM2:
```bash
npm install -g pm2
```

Start server:
```bash
pm2 start src/server.js --name bastion-backend
pm2 save
pm2 startup  # Follow instructions
```

View logs:
```bash
pm2 logs bastion-backend
```

Restart:
```bash
pm2 restart bastion-backend
```

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Set to 'production'

Optional:
- `SESSION_DURATION_HOURS`: Session timeout (default: 24)
- `ALLOWED_ORIGINS`: CORS origins (comma-separated)

## Troubleshooting

Check logs:
```bash
pm2 logs bastion-backend
```

Test connection:
```bash
curl http://localhost:3001/api/health
```

Restart:
```bash
pm2 restart bastion-backend
```
EOF

echo "  ✓ Package created"

echo ""
echo "📤 Step 2: Uploading to server..."

# Create remote directory if it doesn't exist
ssh "$SSH_TARGET" "mkdir -p $REMOTE_PATH"

# Upload backend files
echo "  Uploading backend..."
rsync -avz --progress "$TEMP_DIR/" "$SSH_TARGET:$REMOTE_PATH/" --exclude "shared"

# Upload shared files to sibling directory
echo "  Uploading shared module..."
PARENT_PATH=$(dirname "$REMOTE_PATH")
ssh "$SSH_TARGET" "mkdir -p $PARENT_PATH/shared"
rsync -avz --progress "$TEMP_DIR/shared/" "$SSH_TARGET:$PARENT_PATH/shared/"

echo "  ✓ Files uploaded"

echo ""
echo "🔧 Step 3: Installing dependencies on server..."

ssh "$SSH_TARGET" << ENDSSH
cd $REMOTE_PATH
echo "Installing Node.js dependencies..."
npm install --production
echo "✓ Dependencies installed"
ENDSSH

echo ""
echo "⚙️  Step 4: Configuration..."

# Check if .env exists on remote
ENV_EXISTS=$(ssh "$SSH_TARGET" "test -f $REMOTE_PATH/.env && echo 'yes' || echo 'no'")

if [ "$ENV_EXISTS" = "no" ]; then
    echo "  ⚠️  No .env file found on server"
    echo "  Creating from .env.example..."
    ssh "$SSH_TARGET" "cp $REMOTE_PATH/.env.example $REMOTE_PATH/.env"
    echo ""
    echo "  ⚠️  IMPORTANT: You must edit the .env file on the server!"
    echo "  Run: ssh $SSH_TARGET 'nano $REMOTE_PATH/.env'"
else
    echo "  ✓ .env file exists"
fi

echo ""
echo "🗄️  Step 5: Database setup..."

ssh "$SSH_TARGET" << ENDSSH
cd $REMOTE_PATH

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "  ⚠️  PostgreSQL not found. Please install it:"
    echo "     sudo apt update && sudo apt install postgresql postgresql-contrib"
    exit 1
fi

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw bastion; then
    echo "  ✓ Database 'bastion' exists"
else
    echo "  Creating database 'bastion'..."
    createdb bastion || echo "  ⚠️  Could not create database. You may need to run: sudo -u postgres createdb bastion"
fi
ENDSSH

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Next Steps:"
echo "==========="
echo ""
echo "1. Configure the environment:"
echo "   ssh $SSH_TARGET"
echo "   cd $REMOTE_PATH"
echo "   nano .env"
echo ""
echo "2. Setup database schema (if first deployment):"
echo "   psql bastion < schema.sql"
echo "   psql bastion < schema-family.sql"
echo ""
echo "3. Start the server:"
echo "   npm start"
echo "   # Or with PM2:"
echo "   pm2 start src/server.js --name bastion-backend"
echo "   pm2 save"
echo ""
echo "4. Test the deployment:"
echo "   curl http://$SSH_HOST:3001/api/health"
echo ""
echo "5. Configure firewall (if needed):"
echo "   sudo ufw allow 3001/tcp"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

echo "🎉 Deployment script finished!"
