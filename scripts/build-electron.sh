#!/bin/bash

# Build Electron App Script

set -e

echo "🚀 Building Bastion Electron App"
echo "================================"

# Configuration
API_URL="http://192.168.2.246:3001/api"

echo "Using API URL: $API_URL"

# Step 1: Build Frontend
echo ""
echo "📦 Step 1: Building Frontend..."
cd frontend
VITE_API_URL="$API_URL" npm run build
cd ..

# Step 2: Prepare Electron Build
echo ""
echo "📋 Step 2: Preparing Electron Build..."

# Ensure electron/frontend directory exists
mkdir -p electron/frontend

# Copy frontend build to electron/frontend
echo "  Copying frontend assets..."
cp -r frontend/dist/* electron/frontend/

# Step 3: Build Electron App
echo ""
echo "🔨 Step 3: Building Electron Executable..."
cd electron
npm run build:linux # Default to linux for now, user can change if needed or run specific command
cd ..

echo ""
echo "✅ Build Complete!"
echo "Executable can be found in electron/dist"
