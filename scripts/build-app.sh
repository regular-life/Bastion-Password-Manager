#!/bin/bash

# Bastion Desktop App Build Script
# Builds the Electron app (.exe, .dmg, .AppImage) with remote backend configuration

set -e

echo "🖥️  Bastion Desktop App Build Script"
echo "====================================="
echo ""

# Default backend URL
DEFAULT_BACKEND_URL="http://192.168.2.246:3001"

# Get backend URL
echo "Enter the backend API URL:"
echo "  Example: http://192.168.2.246:3001"
echo "  Example: https://api.bastion.example.com"
echo ""
read -p "Backend URL [$DEFAULT_BACKEND_URL]: " BACKEND_URL
BACKEND_URL=${BACKEND_URL:-$DEFAULT_BACKEND_URL}

echo ""
echo "Select platform to build:"
echo "  1) Windows (.exe)"
echo "  2) macOS (.dmg)"
echo "  3) Linux (.AppImage)"
echo "  4) All platforms"
echo ""
read -p "Enter choice [1-4]: " PLATFORM_CHOICE

case $PLATFORM_CHOICE in
    1) BUILD_TARGET="win";;
    2) BUILD_TARGET="mac";;
    3) BUILD_TARGET="linux";;
    4) BUILD_TARGET="all";;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "Build Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo "  Platform: $BUILD_TARGET"
echo ""

read -p "Continue with build? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Build cancelled."
    exit 0
fi

echo ""
echo "📦 Step 1: Building frontend..."

cd frontend

# Set environment variable for API URL
export VITE_API_URL="$BACKEND_URL"

# Build frontend
npm run build

echo "  ✓ Frontend built"

cd ..

echo ""
echo "🔨 Step 2: Building Electron application..."

cd electron

# Build based on platform choice
case $BUILD_TARGET in
    win)
        echo "  Building Windows installer..."
        npm run build:win
        ;;
    mac)
        echo "  Building macOS installer..."
        npm run build:mac
        ;;
    linux)
        echo "  Building Linux installer..."
        npm run build:linux
        ;;
    all)
        echo "  Building for all platforms..."
        npm run build
        ;;
esac

cd ..

echo ""
echo "✅ Build Complete!"
echo ""
echo "Built files location:"
echo "  electron/dist/"
echo ""

# List built files
if [ -d "electron/dist" ]; then
    echo "Available installers:"
    ls -lh electron/dist/ | grep -E '\.(exe|dmg|AppImage|deb|rpm)$' || echo "  (Building... check electron/dist/ when complete)"
fi

echo ""
echo "Distribution Instructions:"
echo "=========================="
echo ""
echo "1. Test the installer before distributing:"
if [ "$BUILD_TARGET" = "win" ] || [ "$BUILD_TARGET" = "all" ]; then
    echo "   Windows: Run 'Bastion Setup 1.0.0.exe'"
fi
if [ "$BUILD_TARGET" = "mac" ] || [ "$BUILD_TARGET" = "all" ]; then
    echo "   macOS: Open 'Bastion-1.0.0.dmg' and drag to Applications"
fi
if [ "$BUILD_TARGET" = "linux" ] || [ "$BUILD_TARGET" = "all" ]; then
    echo "   Linux: chmod +x Bastion-1.0.0.AppImage && ./Bastion-1.0.0.AppImage"
fi
echo ""
echo "2. The app is configured to connect to: $BACKEND_URL"
echo ""
echo "3. Distribute the installer to users"
echo ""
echo "4. Users should install and run the app normally"
echo ""

echo "🎉 Build script finished!"
