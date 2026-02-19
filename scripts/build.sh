#!/usr/bin/env bash
#
# Lumina full build pipeline
#   1. Build UI (Vite)
#   2. Compile Java -> native shared library (GraalVM native-image)
#   3. Compile C++ host and link everything
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

UI_DIR="$ROOT_DIR/ui-template"
RUNTIME_DIR="$ROOT_DIR/sdk-runtime"
CORE_DIR="$ROOT_DIR/sdk-core"
BUILD_DIR="$ROOT_DIR/build"

echo "══════════════════════════════════════════════════════"
echo " Lumina Build"
echo "══════════════════════════════════════════════════════"

# ─── Step 1: Build the UI ────────────────────────────────────────────────────
echo ""
echo "▸ Step 1/3: Building UI (Vite) ..."
npm install --silent --prefix "$UI_DIR"
npm run build --prefix "$UI_DIR"
echo "  ✓ UI built → $UI_DIR/dist/"

# ─── Step 2: Compile Java to native shared library ──────────────────────────
echo ""
echo "▸ Step 2/3: Compiling Java → native shared library (GraalVM) ..."

# Verify GRAALVM_HOME or JAVA_HOME points to a GraalVM distribution
GRAAL_HOME="${GRAALVM_HOME:-${JAVA_HOME:-}}"
if [ -z "$GRAAL_HOME" ]; then
    echo "  Error: Set GRAALVM_HOME or JAVA_HOME to a GraalVM 21+ distribution."
    exit 1
fi

export JAVA_HOME="$GRAAL_HOME"

"$RUNTIME_DIR/gradlew" --project-dir "$RUNTIME_DIR" nativeCompile

NATIVE_LIB_DIR="$RUNTIME_DIR/build/native/nativeCompile"
echo "  ✓ Native library built → $NATIVE_LIB_DIR/"

# ─── Step 3: Compile C++ host ──────────────────────────────────────────────
echo ""
echo "▸ Step 3/3: Compiling C++ host ..."
mkdir -p "$BUILD_DIR"

cmake -S "$CORE_DIR" -B "$BUILD_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    -DSDK_RUNTIME_LIB="$NATIVE_LIB_DIR" \
    -DUI_BUILD_DIR="$UI_DIR/dist"

cmake --build "$BUILD_DIR" --config Release

echo ""
echo "══════════════════════════════════════════════════════"
echo " Build complete!"
echo " Binary: $BUILD_DIR/lumina-host"
echo " Run:    DYLD_LIBRARY_PATH=$NATIVE_LIB_DIR $BUILD_DIR/lumina-host"
echo "══════════════════════════════════════════════════════"
