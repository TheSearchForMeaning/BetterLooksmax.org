#!/bin/bash

# BetterLooksmax Firefox Production Build Script
# This script creates a production-ready .zip file for Mozilla Firefox

echo "🔨 Building BetterLooksmax for Firefox..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create build directory
BUILD_DIR="dist-firefox"
echo -e "${BLUE}📁 Creating build directory...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy necessary files
echo -e "${BLUE}📋 Copying extension files...${NC}"

# Copy manifest
cp manifest.json "$BUILD_DIR/"

# Copy icons
cp -r icons "$BUILD_DIR/"

# Copy source files
cp -r src "$BUILD_DIR/"

# Copy utils
cp -r utils "$BUILD_DIR/"

# Copy plugins
cp -r plugins "$BUILD_DIR/"

echo -e "${GREEN}✓ Files copied successfully${NC}"

# Create zip file
ZIP_NAME="betterlooksmax-firefox-v$(grep -o '"version": "[^"]*' manifest.json | cut -d'"' -f4).zip"
echo -e "${BLUE}📦 Creating production zip: $ZIP_NAME${NC}"

cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" "*/.*"
cd ..

echo -e "${GREEN}✓ Build complete!${NC}"
echo -e "${YELLOW}📍 Output: $ZIP_NAME${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Visit https://addons.mozilla.org/developers/"
echo "2. Sign in with your Firefox Account"
echo "3. Click 'Submit a New Add-on'"
echo "4. Upload: $ZIP_NAME"
echo "5. Complete the submission process"
echo ""
echo -e "${GREEN}Build directory: $BUILD_DIR${NC}"
echo -e "${GREEN}Production zip: $ZIP_NAME${NC}"
