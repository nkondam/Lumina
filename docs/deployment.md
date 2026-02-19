---
layout: default
title: Deployment
nav_order: 5
---

# Deployment Guide

This guide covers how to package and distribute your Lumina application.

## Build for Production

### Full Build

```bash
./scripts/build.sh
```

This produces `build/lumina-host` (or `.exe` on Windows).

## Platform-Specific Builds

### macOS

The build produces a universal binary. To create an app bundle:

```bash
# Create .app structure
mkdir -p "MyApp.app/Contents/MacOS"
mkdir -p "MyApp.app/Contents/Resources"

# Copy binary
cp build/lumina-host "MyApp.app/Contents/MacOS/MyApp"

# Copy native library alongside binary
cp sdk-runtime/build/native/sdk_runtime.dylib "MyApp.app/Contents/MacOS/"

# Create Info.plist
cat > "MyApp.app/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>MyApp</string>
    <key>CFBundleIdentifier</key>
    <string>com.yourcompany.myapp</string>
    <key>CFBundleName</key>
    <string>My App</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
</dict>
</plist>
EOF
```

### Code Signing (macOS)

```bash
codesign --sign "Developer ID Application: Your Name" \
    --options runtime \
    --entitlements entitlements.plist \
    "MyApp.app"
```

### Linux

Create an AppImage or distribute as a tarball:

```bash
# Tarball distribution
mkdir -p myapp-linux
cp build/lumina-host myapp-linux/
cp sdk-runtime/build/native/sdk_runtime.so myapp-linux/
tar czvf myapp-linux.tar.gz myapp-linux/
```

### Windows

1. Build produces `lumina-host.exe`
2. Distribute alongside `sdk_runtime.dll`
3. Use NSIS or WiX for installer creation

## Distribution Checklist

- [ ] Test on clean system
- [ ] Include all native libraries
- [ ] Code sign for macOS/Windows
- [ ] Create installers (optional)
- [ ] Document system requirements

## Binary Size Optimization

```kotlin
// build.gradle.kts
buildArgs.addAll(
    "-O2",
    "--gc=serial",
    "-H:+RemoveUnusedSymbols",
)
```

Typical sizes: 15-50MB depending on dependencies.
