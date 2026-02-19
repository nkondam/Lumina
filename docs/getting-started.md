# Getting Started with Lumina

This guide will walk you through creating your first Lumina desktop application from scratch.

## Prerequisites

Before you begin, make sure you have installed:

- **GraalVM 21+** with `native-image` component
- **Node.js 18+**
- **CMake 3.20+**
- **Python 3.8+**
- Platform-specific build tools (see README.md)

## Step 1: Install the CLI

First, install the Lumina CLI globally:

```bash
# Clone the Lumina repository
git clone https://github.com/your-username/lumina.git
cd lumina

# Install and link the CLI
cd cli
npm install
npm link
```

Verify the installation:

```bash
lumina --version
# 0.1.0
```

## Step 2: Environment Setup

### Install GraalVM

The easiest way to install GraalVM is using [SDKMAN](https://sdkman.io/):

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash

# Install GraalVM
sdk install java 21.0.2-graal

# Verify installation
java -version
native-image --version
```

### Set Environment Variables

```bash
# Add to your ~/.bashrc, ~/.zshrc, or equivalent
export GRAALVM_HOME=/path/to/graalvm
export JAVA_HOME=$GRAALVM_HOME
export PATH=$GRAALVM_HOME/bin:$PATH
```

## Step 3: Create a New Project

```bash
lumina init
```

Follow the prompts to configure your project:
1.  **Project Name**: e.g., `my-app`
2.  **Backend Language**: Choose `Java`, `Kotlin`, or `Scala`
3.  **UI Framework**: Choose `Vue`, `React`, `Svelte`, `Solid`, `Preact`, `Lit`, or `Vanilla`
4.  **Variant**: `TypeScript` or `JavaScript`
5.  **Package Manager**: `npm`, `pnpm`, `yarn`, or `bun`

```bash
cd my-app
```

This scaffolds a new Lumina project with:
- `backend/` — Server-side code (Java/Kotlin/Scala)
- `frontend/` — Client-side code (Vite + Framework)
- `lumina.json` — Project configuration

## Step 4: Start Development Mode

```bash
lumina dev
```

This starts:

| Process | URL | Description |
|---------|-----|-------------|
| **Vite** | http://localhost:5173 | Frontend with hot reload |
| **DevServer** | http://localhost:8080/rpc | Backend (HTTP REST) |
| **Browser** | | Automatically opens to your app |

### Development Workflow

1. **Edit frontend code** in `frontend/src/` — changes appear instantly
2. **Edit backend routes** in `backend/src/` — restart `lumina dev` to apply changes (hot reload coming soon)
3. **Debug backend** using HTTP requests to `localhost:8080/rpc`

## Step 5: Add Your First Route

### Backend (Java Example)

Edit `backend/src/main/java/app/MyApp.java` to add routes:

```java
public static void registerRoutes(
        java.util.function.BiConsumer<String, Function<String, String>> register) {
    
    // Existing greet route
    register.accept("greet", payload -> { ... });

    // Add a new ping route
    register.accept("ping", payload -> "{\"pong\":true}");
}
```

### Frontend (TypeScript Example)

Edit `frontend/src/main.ts` (or your framework's component):

```typescript
// Call the new route
const response = await window.lumina.send("ping");
console.log(response); // {"pong":true}
```

## Step 6: Build for Production

When ready to ship:

```bash
lumina build
```

This:
1. Builds the UI with Vite (inlined into single HTML)
2. Compiles Java to native shared library (GraalVM)
3. Links the C++ host with embedded assets

The final binary is at `build/lumina-host`.

### Run the Production Binary

```bash
# macOS
DYLD_LIBRARY_PATH=sdk-runtime/build/native/nativeCompile ./build/lumina-host

# Linux
LD_LIBRARY_PATH=sdk-runtime/build/native/nativeCompile ./build/lumina-host
```

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `lumina init <name>` | Create a new project |
| `lumina dev` | Start development mode |
| `lumina build` | Build production binary |

## Dev Mode vs Production Mode

| Aspect | Dev Mode | Production |
|--------|----------|------------|
| Frontend | Vite server (hot reload) | Embedded in binary |
| Backend IPC | HTTP REST (port 8080) | Native C bridge |
| Debugging | Browser DevTools + HTTP | Native debugger |
| Performance | Development speed | Optimized native |

## Next Steps

- Read the [Architecture Guide](architecture.md) to understand how Lumina works
- Check out the [Backend Development Guide](backend-development.md) for advanced Java patterns
- See the [Frontend Development Guide](frontend-development.md) for UI best practices
- Learn about [Deployment](deployment.md) for distributing your application

## Troubleshooting

### "Could not find sdk_runtime.dylib"

The Java native compile step failed or wasn't run. Try:

```bash
cd sdk-runtime
./gradlew clean nativeCompile
```

### "Failed to create GraalVM isolate"

The native library might be corrupted or incompatible. Rebuild:

```bash
cd sdk-runtime
./gradlew clean nativeCompile
```

### DevServer not responding

Make sure port 8080 is not in use:

```bash
lsof -i :8080
```

### "Module not found: 'vite'"

Install Node.js dependencies:

```bash
cd ui-template
npm install
```

### Build hangs on native-image

GraalVM native-image requires significant memory. Ensure you have at least 4GB free RAM:

```bash
export NATIVE_IMAGE_OPTS="-J-Xmx4g"
```
