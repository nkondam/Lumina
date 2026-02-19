#!/bin/bash
set -e

# Define paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/lumina"

# Clean previous build
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
rm -f "$ROOT_DIR/dist/lumina-framework.tar.gz"

echo "📦 Packaging Lumina Framework..."

# Copy core components
echo "  • Copying CLI..."
cp -r "$ROOT_DIR/cli" "$DIST_DIR/"
rm -rf "$DIST_DIR/cli/node_modules"

echo "  • Copying SDK Core..."
cp -r "$ROOT_DIR/sdk-core" "$DIST_DIR/"
rm -rf "$DIST_DIR/sdk-core/build"

echo "  • Copying SDK Runtime..."
cp -r "$ROOT_DIR/sdk-runtime" "$DIST_DIR/"
rm -rf "$DIST_DIR/sdk-runtime/build"
rm -rf "$DIST_DIR/sdk-runtime/.gradle"

echo "  • Copying Scripts..."
cp -r "$ROOT_DIR/scripts" "$DIST_DIR/"

echo "  • Copying Docs..."
cp "$ROOT_DIR/README.md" "$DIST_DIR/"
cp "$ROOT_DIR/LICENSE" "$DIST_DIR/"
cp -r "$ROOT_DIR/docs" "$DIST_DIR/"

# Create install script
cat > "$DIST_DIR/install.sh" <<EOF
#!/bin/bash
set -e

echo "🔧 Installing Lumina..."

# Install CLI dependencies
echo "  • Installing CLI dependencies..."
cd cli
npm install --silent
npm link

# Build Java SDK Runtime
echo "  • Building SDK Runtime (Java)..."
cd ../sdk-runtime
./gradlew jar -q

echo ""
echo "✅ Lumina installed successfully!"
echo "Run 'lumina --help' to get started."
EOF

chmod +x "$DIST_DIR/install.sh"

# Archive
echo "📦 Creating archive..."
cd "$ROOT_DIR/dist"
tar -czf lumina-framework.tar.gz lumina
rm -rf lumina

echo ""
echo "✅ Package created: dist/lumina-framework.tar.gz"
echo "To install on another machine:"
echo "1. Extract the archive"
echo "2. Run ./install.sh"
