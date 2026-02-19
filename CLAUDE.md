# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Lumina?

Lumina is a framework for building native desktop applications with web frontends (TypeScript/HTML/CSS) and JVM backends (Java/Kotlin/Scala). It compiles everything into a single native binary using GraalVM Native Image. The native host uses the OS webview (WebKit on macOS, WebKitGTK on Linux, Edge WebView2 on Windows) — no Electron, no bundled browser.

## Build Commands

### Full build (UI + Java + C++)
```bash
./scripts/build.sh
```

### Individual components

**Frontend (ui-template):**
```bash
cd ui-template && npm install && npm run build
```

**Java runtime (sdk-runtime):**
```bash
cd sdk-runtime && ./gradlew nativeCompile copyNativeLib
```

**C++ host (sdk-core):**
```bash
cd build && cmake ../sdk-core -DSDK_RUNTIME_LIB=../sdk-runtime/build/native/nativeCompile -DUI_BUILD_DIR=../ui-template/dist && cmake --build .
```

### CLI setup
```bash
cd cli && npm install && npm link
```

### CLI commands
```bash
lumina init          # Scaffold a new project
lumina dev           # Dev mode: Vite (5173) + Java DevServer (8080)
lumina build         # Production build → single native binary
lumina run           # Run the production binary
lumina doctor        # Check prerequisites (GraalVM, CMake, Node, etc.)
lumina show          # Display project info and registered routes
lumina generate      # Scaffold routes, components, or pages
```

### Environment requirement
`GRAALVM_HOME` must point to a GraalVM 21+ installation with `native-image` installed.

## Architecture

### Three-layer stack
```
[Browser JS / WebView]  ←→  [C++ Native Host]  ←→  [Java Runtime (.dylib/.so/.dll)]
```

1. **sdk-core/** — C++ native host using the `webview` library. Creates the OS window, manages a GraalVM isolate, and bridges JS↔Java via `__lumina_send` binding.
2. **sdk-runtime/** — Java backend compiled to a shared native library. Exposes `lumina_handle_request()` via `@CEntryPoint`. Routes are registered through `LuminaRuntime.builder().route(name, handler).build()`.
3. **ui-template/** — Vite + TypeScript frontend. Production build inlines all JS/CSS into a single `index.html`, which `embed_assets.py` converts to a C byte array header for embedding in the binary.

### IPC data flow
- Frontend calls `window.lumina.send(route, payload)` (both args are strings, payload is JSON)
- C++ host parses the JSON array `["route", "payload"]`, calls `lumina_handle_request()` on the GraalVM isolate
- Java routes the request to the matching handler registered via `LuminaRuntime`
- Response (JSON string) returns through C++ back to JS via `w.resolve()`
- C++ must free Java-allocated strings via `lumina_free_string()` (unmanaged memory)

### Dev mode vs Production
- **Dev mode** (`lumina dev`): Frontend runs on Vite (localhost:5173), backend runs as a standalone Java HTTP server (localhost:8080/rpc). The frontend polyfills `window.lumina.send()` to make HTTP POST requests instead of native IPC. No native compilation needed.
- **Production** (`lumina build`): Everything compiles to a single binary. UI assets are embedded as a C byte array. IPC is direct function calls through GraalVM C API.

### Build order dependency
The build is sequential: **UI → Java native-image → C++ (links both)**. The C++ build depends on both the Java shared library and the embedded UI assets.

## Key Source Files

### sdk-core/src/main.cpp
- Creates GraalVM isolate, webview window, and IPC binding
- `json_extract_strings()` — hand-written JSON parser (no external deps)
- `--dev` flag switches from embedded HTML to `http://localhost:5173`

### sdk-runtime/src/main/java/dev/lumina/
- **bridge/LuminaBridge.java** — `@CEntryPoint` methods (`lumina_handle_request`, `lumina_free_string`). Converts between C strings (`CCharPointer`) and Java strings. Allocates response in unmanaged memory (outside GC) so C++ can read it.
- **runtime/LuminaRuntime.java** — Developer-facing API. Builder pattern registers routes into a `ConcurrentHashMap<String, Function<String, String>>`. Multiple `build()` calls are additive (merges routes). Thread-safe.
- **runtime/LuminaFeature.java** — GraalVM `Feature` registered via `META-INF/services`. Runs at build time to register framework-level routes (e.g., `ping`).
- **runtime/DevServer.java** — Standalone HTTP server for dev mode. Accepts `POST /rpc` with `{"route":"...", "payload":"..."}`. Uses `ServiceLoader<LuminaRouteProvider>` to discover app routes. CORS-enabled for Vite.

### cli/src/commands/
- **init.js** — Interactive project scaffolding. Supports Java/Kotlin/Scala backends and Vue/React/Svelte/Solid/Preact/Lit/Vanilla frontends. Creates `lumina.json`, backend/, and frontend/ directories.
- **dev.js** — Spawns Vite + Java DevServer as child processes with graceful shutdown.
- **build.js** — Orchestrates the full build pipeline (frontend → Gradle → native-image → CMake).
- **generate.js** — Generates routes, components, or pages from templates.

### scripts/embed_assets.py
Converts `ui-template/dist/index.html` into `build/embedded_assets.h` — a C byte array (`static const unsigned char LUMINA_INDEX_HTML[]`).

## Code Conventions

- **Java**: Google Java Style Guide. Route handlers are `Function<String, String>` (JSON in → JSON out). Errors become `{"error":"message"}`. Manual JSON parsing is used throughout to avoid reflection/dependencies that complicate GraalVM native-image.
- **C++**: Google C++ Style Guide. No external JSON library — string parsing is manual.
- **TypeScript**: Prettier with default settings.
- **Commit messages**: Conventional Commits format — `type(scope): summary` (e.g., `feat(bridge): add binary payload support`).

## Project configuration

App projects use a `lumina.json` at their root:
```json
{
  "name": "my-app",
  "lumina": {
    "framework": "../../",
    "frontend": { "dir": "frontend", "entry": "index.html" },
    "backend": { "dir": "backend", "mainClass": "com.example.MyApp" }
  }
}
```

The CLI detects project context by walking up the directory tree looking for `lumina.json` (app project) or `sdk-core/` (framework repo).

## Important constraints

- **No reflection by default**: GraalVM native-image requires explicit reflection configuration. If adding a library that uses reflection, add entries to `sdk-runtime/src/main/resources/META-INF/native-image/reflect-config.json`.
- **No filesystem access at runtime for UI**: Assets are embedded at build time. The webview loads from an in-memory byte array, not from disk.
- **Memory management across the bridge**: Java responses are allocated in unmanaged memory (`UnmanagedMemory.malloc`). The C++ host must call `lumina_free_string()` after consuming the response. Failing to do so causes memory leaks.
- **DevServer uses ServiceLoader**: App routes in dev mode are discovered via `META-INF/services/dev.lumina.runtime.LuminaRouteProvider`. Apps must implement this interface for dev mode to work.
