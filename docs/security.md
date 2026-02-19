---
layout: default
title: Security
nav_order: 6
---

# Security Considerations

This document outlines security considerations for Lumina applications.

## Production Architecture Security

### Strengths

| Aspect | Security Benefit |
|--------|------------------|
| **Embedded UI** | No remote code loading; UI is compiled into the binary |
| **Native IPC** | Communication happens via in-process C function calls |
| **GraalVM Isolate** | Java code runs in isolated native context |
| **Controlled Routes** | Only explicitly registered routes are accessible |
| **OS WebView** | Uses system WebView with default security policies |

### Route Security

Routes are the attack surface of your application. Follow these best practices:

```java
// ✅ Good: Validate inputs
.route("user/update", payload -> {
    var request = Json.fromJson(payload, UpdateUserRequest.class);
    if (request.id() == null || request.id().isBlank()) {
        return "{\"error\":\"invalid_id\"}";
    }
    // Process validated request
})

// ❌ Bad: No input validation
.route("user/update", payload -> {
    // Directly using unvalidated input
})
```

### Content Security Policy

The embedded WebView doesn't load external content by default, but if you add external resources, consider implementing CSP headers.

---

## Development Mode Security

### ⚠️ Important: Dev Mode is NOT for Production

The `DevServer` (HTTP REST on port 8080) is designed **only for local development**:

| Aspect | Dev Mode Behavior | Security Implication |
|--------|-------------------|----------------------|
| **CORS** | `Access-Control-Allow-Origin: *` | Any origin can make requests |
| **Authentication** | None | No access control |
| **Binding** | `localhost:8080` | Only local access (by design) |
| **Encryption** | HTTP (not HTTPS) | Traffic is unencrypted |

### Safe Development Practices

1. **Never expose dev mode to the network**
   ```bash
   # DevServer should only be accessible locally
   curl http://localhost:8080/rpc  # ✅ OK
   # Do not expose port 8080 to external networks
   ```

2. **Don't use dev mode in production**
   - Production builds embed the UI and use native IPC
   - The DevServer is not included in production binaries

3. **Firewall the dev port**
   ```bash
   # If concerned about local network exposure
   # Block port 8080 from external access
   ```

### Why HTTP REST for Dev Mode is Safe

The dev mode HTTP server is intentionally simple and permissive because:

1. **Local-only access**: Binds to localhost
2. **Same route table**: Tests the exact same code paths as production
3. **No sensitive data in dev**: Development typically uses test data
4. **Short-lived**: Only runs during development sessions

---

## Binary Distribution Security

### Code Signing

Always sign your production binaries:

**macOS:**
```bash
codesign --sign "Developer ID Application: Your Name" \
    --options runtime \
    --entitlements entitlements.plist \
    "MyApp.app"

# Notarize for Gatekeeper
xcrun notarytool submit MyApp.zip --apple-id ... --wait
```

**Windows:**
```powershell
signtool sign /f certificate.pfx /p password /tr http://timestamp.url MyApp.exe
```

### Entitlements (macOS)

Create `entitlements.plist` with minimal permissions:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

---

## Dependency Security

### GraalVM Native Image

- Uses ahead-of-time compilation; no JIT attack surface
- Smaller attack surface than full JVM
- Regular updates recommended

### WebView Security

- Uses OS-provided WebView (not bundled browser)
- Inherits system security updates
- WebKit (macOS), WebKitGTK (Linux), Edge WebView2 (Windows)

### Third-Party Libraries

Audit your Java dependencies:

```bash
./gradlew dependencyCheckAnalyze  # OWASP dependency check
```

---

## Checklist for Production

- [ ] Remove or disable DevServer code in production builds
- [ ] Validate all route inputs
- [ ] Code sign binaries (macOS/Windows)
- [ ] Notarize for macOS Gatekeeper
- [ ] Audit third-party dependencies
- [ ] Test with minimal permissions
- [ ] Document security contact for vulnerability reports

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Email security@example.com with details
3. Allow reasonable time for a fix before disclosure
