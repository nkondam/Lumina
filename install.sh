#!/bin/bash
set -e

# Configuration
REPO_URL="https://github.com/nkondam/lumina.git"
INSTALL_DIR="$HOME/.lumina"
BRANCH="main"

echo "✨ Installing Lumina Framework..."

# 1. Clone or Update
if [ -d "$INSTALL_DIR" ]; then
    echo "  • Updating existing installation in $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    echo "  • Cloning repository to $INSTALL_DIR..."
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 2. Check Prerequisites (Java/Node)
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Please install Java 21+ first."
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# 3. Install CLI dependencies & Link
echo "  • Installing CLI dependencies..."
cd cli
npm ci --silent > /dev/null
# Use npm link so 'lumina' command is available globally
npm link --silent

# 4. Build Java runtime JARs (speeds up subsequent builds)
echo "  • Pre-building SDK Runtime (Java)..."
cd ../sdk-runtime
# Use ./gradlew wrapper to ensure gradlew is executable
chmod +x gradlew
./gradlew jar -q

# 5. Set Environment Variable (Optional but recommended)
# We might want to append export LUMINA_HOME to shell config if we want strict paths
# But since we npm link, the CLI can find itself relative to symlink or via __dirname logic we added.

echo ""
echo "✅ Lumina installed successfully!"
echo "Run 'lumina --help' to get started."
