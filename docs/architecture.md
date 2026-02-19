# Lumina Architecture

This document provides an in-depth look at Lumina's architecture and how its components work together.

## Overview

Lumina is a hybrid architecture that combines:

1. **Native C++ Host** — Manages the window and WebView
2. **GraalVM Native Library** — Java backend compiled to native code
3. **Web Frontend** — TypeScript/JavaScript UI running in the WebView

```
┌──────────────────────────────────────────────────────────────────┐
│                        Operating System                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   lumina-host (executable)                 │  │
│  │                                                            │  │
│  │  ┌───────────────────┐    ┌─────────────────────────────┐  │  │
│  │  │    C++ Host       │    │     sdk_runtime.dylib       │  │  │
│  │  │                   │    │     (GraalVM Native)        │  │  │
│  │  │  • main.cpp       │◄──►│                             │  │  │
│  │  │  • webview.h      │    │  • LuminaBridge.java        │  │  │
│  │  │  • IPC handler    │    │  • LuminaRuntime.java       │  │  │
│  │  │                   │    │  • Your Java code           │  │  │
│  │  └────────┬──────────┘    └─────────────────────────────┘  │  │
│  │           │                                                 │  │
│  │           │ Embedded HTML                                   │  │
│  │           ▼                                                 │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │                    OS WebView                         │  │  │
│  │  │  ┌─────────────────────────────────────────────────┐  │  │  │
│  │  │  │              Your Web UI                        │  │  │  │
│  │  │  │           (TypeScript/React/Vue)                │  │  │  │
│  │  │  └─────────────────────────────────────────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. C++ Native Host (`sdk-core/`)

The C++ host is the entry point of the application. It's responsible for:

- **Creating the native window** using the [webview](https://github.com/webview/webview) library
- **Managing the GraalVM isolate** (lightweight JVM context)
- **Setting up the IPC bridge** between JavaScript and Java
- **Loading embedded UI assets** at startup

#### Key Files

| File | Purpose |
|------|---------|
| `main.cpp` | Application entry point and setup |
| `CMakeLists.txt` | Build configuration |

#### Initialization Flow

```cpp
int main() {
    // 1. Create GraalVM isolate
    graal_create_isolate(nullptr, &isolate, &thread);

    // 2. Create native window
    webview::webview w(false, nullptr);
    w.set_title("Lumina App");
    w.set_size(1024, 768, WEBVIEW_HINT_NONE);

    // 3. Bind IPC function
    w.bind("__lumina_send", lumina_ipc_handler, &w);

    // 4. Inject JavaScript API
    w.init("window.lumina = { send: ... }");

    // 5. Load embedded HTML
    w.set_html(html);

    // 6. Run event loop
    w.run();
}
```

### 2. Java Runtime (`sdk-runtime/`)

The Java runtime contains your application's business logic. It's compiled to a native shared library using GraalVM Native Image.

#### Key Classes

| Class | Purpose |
|-------|---------|
| `LuminaBridge` | C↔Java interop layer with `@CEntryPoint` methods |
| `LuminaRuntime` | Developer-facing API for registering routes |
| `LuminaFeature` | GraalVM build-time hook |
| `DevServer` | HTTP JSON-RPC server for dev mode |

#### LuminaBridge

This class exposes Java methods to C++ via GraalVM's Native Image C API:

```java
@CEntryPoint(name = "lumina_handle_request")
public static CCharPointer handleRequest(
        IsolateThread thread,
        CCharPointer routePtr,
        CCharPointer payloadPtr) {
    
    String route = CTypeConversion.toJavaString(routePtr);
    String payload = CTypeConversion.toJavaString(payloadPtr);
    
    String response = handler.handle(route, payload);
    
    return toCString(response);
}
```

#### LuminaRuntime

The main API for application developers:

```java
LuminaRuntime.builder()
    .route("users/list", this::handleListUsers)
    .route("users/create", this::handleCreateUser)
    .route("users/delete", this::handleDeleteUser)
    .build();
```

#### DevServer (Dev Mode)

In development mode, the `DevServer` provides an HTTP REST endpoint that uses the same route table as production. This enables browser-based debugging without native compilation.

```java
// DevServer listens on http://localhost:8080/rpc
// Accepts POST with JSON body: {"route": "...", "payload": "..."}
// Uses LuminaBridge.getHandler() for dispatch — same routes as production
```

**Why HTTP REST for Dev Mode?**

| Benefit | Description |
|---------|-------------|
| **Browser DevTools** | Full debugging with Chrome/Firefox DevTools |
| **Hot Reload** | Vite HMR for instant UI updates |
| **HTTP Debugging** | Test routes with curl, Postman, etc. |
| **No Native Build** | Frontend development without GraalVM compilation |
| **Code Parity** | Same route handlers as production |

### 3. Frontend (`ui-template/`)

The frontend is a standard web application built with Vite and TypeScript.

#### Build Process

1. **Development**: Vite dev server for hot module replacement
2. **Production**: All assets inlined into a single `index.html` using `vite-plugin-singlefile`
3. **Embedding**: `embed_assets.py` converts `index.html` to a C++ byte array

#### JavaScript API

The C++ host injects a thin API layer:

```javascript
window.lumina = {
    send: function(route, payload) {
        return __lumina_send(route, payload || "{}");
    }
};
```

Where `__lumina_send` is bound to the C++ `lumina_ipc_handler` function.

## IPC Message Flow

Understanding the complete request/response cycle:

```
1. Frontend calls window.lumina.send("route", "{payload}")
                    │
                    ▼
2. WebView serializes call to: ["route", "{payload}"]
                    │
                    ▼
3. C++ lumina_ipc_handler receives serialized string
                    │
                    ▼
4. C++ parses route and payload from JSON
                    │
                    ▼
5. C++ calls lumina_handle_request(thread, route, payload)
                    │
                    ▼
6. Java LuminaBridge.handleRequest() receives the call
                    │
                    ▼
7. Java routes to registered handler
                    │
                    ▼
8. Handler processes request and returns JSON string
                    │
                    ▼
9. Java allocates unmanaged memory and returns CCharPointer
                    │
                    ▼
10. C++ receives response string
                    │
                    ▼
11. C++ calls w.resolve(seq, 0, response) to resolve Promise
                    │
                    ▼
12. C++ calls lumina_free_string to release memory
                    │
                    ▼
13. JavaScript Promise resolves with response string
```

## Memory Management

### GraalVM Isolates

Each Lumina app runs in a single GraalVM isolate, which is a lightweight, isolated execution context. The isolate is created at startup and torn down when the window closes.

### String Passing

Strings passed between C++ and Java require special handling:

1. **C++ → Java**: `CTypeConversion.toJavaString()` creates a Java string from C pointer
2. **Java → C++**: Response strings are allocated in "unmanaged memory" (outside GC)
3. **Cleanup**: C++ must call `lumina_free_string()` to release the memory

## Build Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        Build Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Build UI                                               │
│  ┌──────────────┐    npm run build    ┌───────────────────┐    │
│  │  TypeScript  │ ─────────────────► │  dist/index.html  │    │
│  │  + CSS       │                     │  (single file)    │    │
│  └──────────────┘                     └─────────┬─────────┘    │
│                                                 │              │
│  Step 2: Embed Assets                           │              │
│  ┌──────────────┐    embed_assets.py  ┌────────▼────────┐     │
│  │ index.html   │ ─────────────────► │embedded_assets.h│     │
│  └──────────────┘                     └─────────┬───────┘     │
│                                                 │              │
│  Step 3: Compile Java                           │              │
│  ┌──────────────┐    native-image     ┌────────▼────────┐     │
│  │  Java code   │ ─────────────────► │sdk_runtime.dylib│     │
│  └──────────────┘                     └─────────┬───────┘     │
│                                                 │              │
│  Step 4: Link C++                               │              │
│  ┌──────────────┐                     ┌────────▼────────┐     │
│  │  main.cpp    │ + embedded_assets.h│                  │     │
│  │              │ + sdk_runtime.dylib│   lumina-host    │     │
│  │              │ ─────────────────► │  (executable)   │     │
│  └──────────────┘                     └─────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Platform-Specific Details

### macOS

- **WebView**: WKWebView (WebKit)
- **Libraries**: Cocoa, WebKit frameworks
- **Binary**: Universal binary possible with `lipo`

### Linux

- **WebView**: WebKitGTK
- **Libraries**: gtk+-3.0, webkit2gtk-4.1
- **Binary**: ELF executable

### Windows

- **WebView**: Edge WebView2 (Chromium-based)
- **Libraries**: advapi32, ole32, shell32, etc.
- **Binary**: PE executable (.exe)

## Performance Characteristics

| Metric | Typical Value | Notes |
|--------|---------------|-------|
| Startup time | 50-200ms | Thanks to native compilation |
| Memory (idle) | 30-80MB | Depends on UI complexity |
| Binary size | 15-50MB | Includes JVM runtime |
| IPC latency | <1ms | For simple operations |

## Security Considerations

1. **No remote code execution**: UI is embedded, not loaded from network
2. **Isolate boundary**: Java code runs in isolated GraalVM context
3. **Controlled IPC**: Only explicitly registered routes are accessible
4. **Native sandboxing**: Uses OS WebView with default security settings

## Next Steps

- [Backend Development Guide](backend-development.md) — Learn advanced Java patterns
- [Frontend Development Guide](frontend-development.md) — Build beautiful UIs
- [Deployment Guide](deployment.md) — Package and distribute your app
