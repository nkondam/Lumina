<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20|%20Linux%20|%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/Java-21+-orange" alt="Java 21+" />
  <img src="https://img.shields.io/badge/GraalVM-24.1+-green" alt="GraalVM" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" alt="License" />
</p>

# ✨ Lumina

**Build native desktop applications with TypeScript frontends and JVM backends.**

Lumina is a lightweight, high-performance framework for creating cross-platform desktop applications. It combines the power of Java/JVM backends with modern TypeScript/JavaScript frontends, compiled into a single native binary using GraalVM Native Image.

---

## 🚀 Features

- **🔥 Native Performance** — GraalVM Native Image compiles your Java backend to native code for instant startup and low memory footprint
- **🌐 Modern Web Frontend** — Build your UI with TypeScript, Vite, and any web framework (React, Vue, Svelte, etc.)
- **📦 Single Binary Distribution** — Your entire application ships as one executable with embedded assets
- **🔗 Simple IPC Bridge** — Easy-to-use `window.lumina.send()` API for frontend-backend communication
- **🖥️ Cross-Platform** — Build for macOS, Linux, and Windows from a single codebase
- **🪶 Lightweight** — Uses the native OS WebView (WebKit on macOS, WebKitGTK on Linux, Edge WebView2 on Windows)

---

## � Documentation

For detailed guides and tutorials, see our comprehensive documentation:

| Guide | Description |
|-------|-------------|
| **[Getting Started](docs/getting-started.md)** | Step-by-step setup for first-time users |
| **[Architecture](docs/architecture.md)** | Deep dive into how Lumina works internally |
| **[Backend Development](docs/backend-development.md)** | Java patterns, database access, testing |
| **[Frontend Development](docs/frontend-development.md)** | TypeScript, React/Vue integration, styling |
| **[Deployment](docs/deployment.md)** | Packaging for macOS, Linux, and Windows |
| **[Security](docs/security.md)** | Security considerations and best practices |

---

## 📑 Table of Contents

- [Features](#-features)
- [Documentation](#-documentation)
- [Project Structure](#-project-structure)
- [Prerequisites](#️-prerequisites)
- [Quick Start](#-quick-start)
- [CLI Commands](#️-cli-commands)
- [Developer Guide](#-developer-guide)
- [Customizing the Frontend](#-customizing-the-frontend)
- [Build Configuration](#️-build-configuration)
- [Architecture](#️-architecture)
- [Advanced Topics](#-advanced-topics)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📦 Project Structure

```
lumina/
├── cli/                      # Command-line interface
│   ├── src/
│   │   ├── index.js          # CLI entry point
│   │   └── commands/         # init, dev, build commands
│   └── package.json
│
├── sdk-core/                 # C++ native host application
│   ├── CMakeLists.txt        # CMake build configuration
│   └── src/
│       └── main.cpp          # Native window and IPC handler
│
├── sdk-runtime/              # Java/Kotlin backend runtime
│   ├── build.gradle.kts      # Gradle build with GraalVM native-image
│   └── src/main/java/
│       └── dev/lumina/
│           ├── bridge/
│           │   └── LuminaBridge.java    # C↔Java interop
│           └── runtime/
│               ├── LuminaRuntime.java   # Developer API
│               ├── LuminaFeature.java   # GraalVM build-time hook
│               └── DevServer.java       # HTTP server for dev mode
│
├── ui-template/              # TypeScript/Vite frontend template
│   ├── index.html            # Entry HTML
│   ├── src/main.ts           # Frontend code (auto-detects dev/prod)
│   ├── vite.config.ts        # Vite build configuration
│   └── package.json
│
├── examples/                 # Example applications
│   ├── notes-app/            # Note-taking app with CRUD & search
│   └── task-manager/         # Task management demo
│
├── scripts/
│   ├── build.sh              # Full build pipeline script
│   └── embed_assets.py       # Embeds UI into C++ header
│
└── build/                    # Build output directory
    └── lumina-host           # Final native executable
```

---

## 🛠️ Prerequisites

Before building Lumina, ensure you have the following installed:

| Requirement | Version | Notes |
|-------------|---------|-------|
| **GraalVM** | 21+ | With `native-image` component installed |
| **Java** | 21+ | Included with GraalVM |
| **Node.js** | 18+ | For building the frontend |
| **CMake** | 3.20+ | For building the native host |
| **Python** | 3.8+ | For asset embedding script |

### Platform-Specific Requirements

<details>
<summary><b>macOS</b></summary>

- Xcode Command Line Tools: `xcode-select --install`
- CMake: `brew install cmake`

</details>

<details>
<summary><b>Linux</b></summary>

```bash
# Ubuntu/Debian
sudo apt install build-essential cmake libgtk-3-dev libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install gcc-c++ cmake gtk3-devel webkit2gtk4.1-devel
```

</details>

<details>
<summary><b>Windows</b></summary>

- Visual Studio 2022 with C++ workload
- CMake (included with VS or install separately)
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows 10/11)

</details>

---

## ⚡ Quick Start

### 1. Install the CLI

```bash
# From the lumina repository
cd cli
npm install
npm link    # Makes 'lumina' available globally
```

### 2. Create a New Project

```bash
lumina init
# Follow the interactive prompts to select:
# - Project Name
# - Backend Language (Java, Kotlin, Scala)
# - UI Framework (Vue, React, Svelte, etc.)
# - Variant (TypeScript, JavaScript)
# - Package Manager (npm, pnpm, yarn, bun)

cd <project-name>
```

### 3. Set GraalVM Environment

```bash
# Set GRAALVM_HOME to your GraalVM installation
export GRAALVM_HOME=/path/to/graalvm-jdk-21

# Or if using SDKMAN
sdk use java 21.0.2-graal
export GRAALVM_HOME=$JAVA_HOME
```

### 4. Start Development Mode

```bash
lumina dev
```

This starts:
- **Vite dev server** at `http://localhost:5173` (with hot reload)
- **Java DevServer** at `http://localhost:8080/rpc` (REST API for debugging)
- **Opens your browser** automatically to the app

### 5. Build for Production

```bash
lumina build
```

This compiles everything into a single native binary.

---

## 🛠️ CLI Commands

| Command | Description |
|---------|-------------|
| `lumina init [name]` | Scaffold a new Lumina project interactively |
| `lumina dev` | Start dev mode with hot reload |
| `lumina build` | Build production binary |
| `lumina run` | Run the production binary |
| `lumina doctor` | Check environment prerequisites |
| `lumina show` | Display project info and routes |
| `lumina generate` | Scaffold components or routes |
| `lumina update` | Update Lumina CLI to the latest version |
| `lumina version` | Show CLI version |

### Dev Mode Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        lumina dev                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser (localhost:5173)         Java DevServer (:8080/rpc)   │
│   ┌─────────────────────┐          ┌─────────────────────┐      │
│   │   Vite Dev Server   │◄──HTTP──►│  REST JSON-RPC      │      │
│   │   (Hot Reload)      │          │  Same route table   │      │
│   │                     │          │  as production      │      │
│   └─────────────────────┘          └─────────────────────┘      │
│                                                                  │
│   Optional: Native Webview (--dev mode)                         │
│   ┌─────────────────────┐                                       │
│   │   lumina-host       │ ◄──── Points to Vite server           │
│   │   --dev flag        │        instead of embedded HTML       │
│   └─────────────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

In dev mode, the frontend communicates with the backend via HTTP REST instead of the native IPC bridge. This enables:
- **Browser DevTools** for debugging
- **Hot module replacement** for instant UI updates
- **Standard HTTP debugging** with curl, Postman, etc.
- **No native compilation required** for UI development

---

## 📚 Developer Guide

### Defining Backend Routes

Routes are the core communication mechanism between your frontend and backend. Define them in Java using the builder pattern:

```java
// In your application's main initialization
import dev.lumina.runtime.LuminaRuntime;

public class MyApp {
    static {
        LuminaRuntime.builder()
            .route("ping", payload -> "{\"pong\":true}")
            .route("greet", payload -> {
                // Parse JSON payload and return response
                String name = parseJson(payload).get("name");
                return "{\"message\":\"Hello, " + name + "!\"}";
            })
            .route("fetchData", payload -> {
                // Complex business logic here
                var data = myDatabase.query(payload);
                return toJson(data);
            })
            .build();
    }
}
```

#### Route Handler Signature

```java
@FunctionalInterface
public interface RequestHandler {
    String handle(String route, String payload);
}
```

- **Input**: `payload` is a JSON string from the frontend
- **Output**: Return a JSON string to send back to the frontend
- **Errors**: Throw an exception and it will be serialized as `{"error": "message"}`

### Calling Routes from Frontend

Use the `window.lumina.send()` API to communicate with your backend:

```typescript
// TypeScript type declarations (included in ui-template)
declare global {
  interface Window {
    lumina: {
      send: (route: string, payload?: string) => Promise<string>;
    };
  }
}

// Simple ping
const response = await window.lumina.send("ping");
console.log(response); // {"pong":true}

// Send data to backend
const greeting = await window.lumina.send("greet", JSON.stringify({
  name: "World"
}));
console.log(JSON.parse(greeting)); // {message: "Hello, World!"}

// Async data fetching
async function loadUserData(userId: string) {
  const response = await window.lumina.send("user/get", JSON.stringify({ id: userId }));
  return JSON.parse(response);
}
```

---

## 🎨 Customizing the Frontend

The UI template uses Vite for fast development and optimized production builds.

### Development Mode

```bash
cd ui-template
npm install
npm run dev
```

This starts the Vite dev server at `http://localhost:5173`. Note that `window.lumina` will not be available in browser mode — you'll need to mock it for development.

### Production Build

```bash
npm run build
```

This creates a single `index.html` file with all assets inlined (via `vite-plugin-singlefile`), ready for embedding into the native binary.

### Using React, Vue, or Other Frameworks

Simply install your framework of choice:

```bash
# React
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react

# Vue
npm install vue
npm install -D @vitejs/plugin-vue

# Svelte
npm install svelte
npm install -D @sveltejs/vite-plugin-svelte
```

Then update `vite.config.ts` to include the framework plugin.

---

## ⚙️ Build Configuration

### Gradle (Java/GraalVM)

The `sdk-runtime/build.gradle.kts` configures GraalVM Native Image:

```kotlin
graalvmNative {
    binaries {
        named("main") {
            sharedLibrary.set(true)           // Build as .dylib/.so/.dll
            imageName.set("sdk_runtime")       // Output library name
            buildArgs.addAll(
                "--no-fallback",               // Error if native compilation fails
                "-H:+ReportExceptionStackTraces",
                "-march=native",               // Optimize for current CPU
                "-O2",                         // Optimization level
                "--gc=serial",                 // Minimal GC for small footprint
            )
        }
    }
}
```

### CMake (C++ Host)

Key CMake variables in `sdk-core/CMakeLists.txt`:

| Variable | Description |
|----------|-------------|
| `SDK_RUNTIME_LIB` | Directory containing GraalVM native library |
| `UI_BUILD_DIR` | Directory containing built UI assets |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Lumina Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐         ┌─────────────────────────┐   │
│   │   UI (WebView)  │◄───────►│    C++ Native Host      │   │
│   │                 │   IPC   │                         │   │
│   │  • TypeScript   │         │  • Window Management    │   │
│   │  • React/Vue/   │         │  • OS Webview (webview) │   │
│   │    Svelte/etc   │         │  • GraalVM Isolate      │   │
│   │  • CSS/HTML     │         │                         │   │
│   └─────────────────┘         └───────────┬─────────────┘   │
│                                           │                  │
│                               GraalVM C API                  │
│                                           │                  │
│                               ┌───────────▼─────────────┐   │
│                               │   Java Runtime (.so)    │   │
│                               │                         │   │
│                               │  • LuminaBridge (IPC)   │   │
│                               │  • LuminaRuntime (API)  │   │
│                               │  • Your Business Logic  │   │
│                               │  • Any JVM Libraries    │   │
│                               └─────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Frontend calls** `window.lumina.send("route", "{payload}")`
2. **WebView** serializes and sends to the bound C++ function
3. **C++ Host** forwards to `lumina_handle_request()` via GraalVM C API
4. **Java Runtime** routes the request to the appropriate handler
5. **Response** travels back through the same path as a JSON string

---

## 🔧 Advanced Topics

### Adding Custom Java Dependencies

Add dependencies to `sdk-runtime/build.gradle.kts`:

```kotlin
dependencies {
    compileOnly("org.graalvm.sdk:nativeimage:24.1.1")
    
    // Add your libraries
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("org.xerial:sqlite-jdbc:3.46.0.0")
}
```

> **Note**: Some libraries require additional GraalVM configuration for reflection, resources, or JNI. See the [GraalVM Native Image documentation](https://www.graalvm.org/latest/reference-manual/native-image/).

### Reflection Configuration

If your dependencies use reflection, create `sdk-runtime/src/main/resources/META-INF/native-image/reflect-config.json`:

```json
[
  {
    "name": "com.example.MyClass",
    "allDeclaredConstructors": true,
    "allDeclaredMethods": true,
    "allDeclaredFields": true
  }
]
```

### Debugging

Enable debug mode in the C++ host:

```cpp
// In sdk-core/src/main.cpp
webview::webview w(/*debug=*/true, nullptr);  // Enable DevTools
```

### Logging

Add logging in your Java handlers:

```java
.route("debug", payload -> {
    System.out.println("Received: " + payload);  // Goes to terminal
    return "{\"logged\":true}";
})
```

---

## 📝 API Reference

### JavaScript API

```typescript
interface LuminaAPI {
  /**
   * Send a request to the Java backend.
   * @param route - The route name (registered via LuminaRuntime.builder().route())
   * @param payload - Optional JSON string payload
   * @returns Promise resolving to the JSON string response
   * @throws Error if the backend throws an exception
   */
  send(route: string, payload?: string): Promise<string>;
}

// Access via window.lumina
declare global {
  interface Window {
    lumina: LuminaAPI;
  }
}
```

### Java API

```java
// Main builder API
LuminaRuntime.builder()
    .route(String name, Function<String, String> handler)
    .build();

// Direct handler registration (advanced)
LuminaBridge.setHandler(LuminaBridge.RequestHandler handler);
```

---

## ❓ Troubleshooting

### "Could not find sdk_runtime.dylib"

The Java native compile step failed or wasn't run:

```bash
cd sdk-runtime
./gradlew clean nativeCompile copyNativeLib
```

### "Failed to create GraalVM isolate"

The native library might be corrupted. Rebuild completely:

```bash
cd sdk-runtime
./gradlew clean nativeCompile
```

### "Module not found" errors in ui-template

Install Node.js dependencies:

```bash
cd ui-template
npm install
```

### Build hangs on native-image

GraalVM native-image requires significant memory. Ensure at least 4GB free RAM:

```bash
export NATIVE_IMAGE_OPTS="-J-Xmx4g"
```

### WebView blank or not loading

Enable debug mode in `sdk-core/src/main.cpp`:

```cpp
webview::webview w(/*debug=*/true, nullptr);
```

> 📚 **For more troubleshooting help**, see the [Getting Started Guide](docs/getting-started.md#troubleshooting).

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Pull request process

**Quick start:**

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [webview](https://github.com/webview/webview) — The tiny cross-platform webview library
- [GraalVM](https://www.graalvm.org/) — High-performance polyglot VM
- [Vite](https://vitejs.dev/) — Next generation frontend tooling

---

<p align="center">
  <b>Built with ❤️ for developers who want the best of both worlds</b>
</p>
