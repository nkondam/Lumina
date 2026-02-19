## Project Structure

a framework for building tiny, fast binaries for all major desktop and mobile platforms. Developers can integrate any frontend framework that compiles to HTML, JavaScript with modern frameworks like (react, angular, or vue), and CSS for building their user experience while leveraging JVM languages such as Java for backend logic when needed

## Key Directories
* `sdk-core/` - contains C++ Native Host
* `sdk-runtime/` - Java Backend (Gradle + GraalVM)
* `ui-template/` - Vite + TypeScript starter
* `scripts/`
* `docs/` - Project documentation and advanced troubleshooting guides.

## Key Design
Data Flow

[Browser JS]                    [C++ Host]                 [Java Native Lib]
│                               │                            │
│ window.lumina.send(route,pay) │                            │
│──────────────────────────────>│                            │
│                               │ lumina_handle_request()    │
│                               │───────────────────────────>│
│                               │     (GraalVM @CEntryPoint)│
│                               │<───────────────────────────│
│          resolve(response)    │                            │
│<──────────────────────────────│                            │

## Key Design Decisions
- LuminaBridge.java uses @CEntryPoint with CCharPointer for zero-copy string passing. The caller (C++) is responsible for freeing returned strings via lumina_free_string.
- main.cpp creates a single GraalVM isolate, binds __lumina_send via webview's bind() API, then injects window.lumina.send() as the public JS interface.
- UI assets are inlined -- Vite is configured to inline all JS/CSS, then embed_assets.py converts dist/index.html into a C byte array header. No filesystem access at runtime.
- Gradle + org.graalvm.buildtools.native compiles the Java code with --shared to produce libsdk_runtime.dylib/.so/.dll + a C header.