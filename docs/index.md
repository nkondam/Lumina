---
layout: home
title: Home
nav_order: 0
---

# Lumina

Build native desktop apps with web frontends and JVM backends.
{: .fs-6 .fw-300 }

Lumina compiles a TypeScript/HTML/CSS frontend and a Java/Kotlin/Scala backend into a **single native binary** using GraalVM Native Image. The native host uses the OS webview (WebKit on macOS, WebKitGTK on Linux, Edge WebView2 on Windows) — no Electron, no bundled browser.

[Get Started](getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/nkondam/Lumina){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Key Features

- **Single binary** — Ship one file, no runtime dependencies
- **Native webview** — Uses the OS browser engine, not Electron
- **JVM backend** — Write backend logic in Java, Kotlin, or Scala
- **Web frontend** — Use any web framework (Vue, React, Svelte, Solid, etc.)
- **Dev mode** — Hot-reload frontend with Vite, backend with standard JVM tooling
- **CLI tooling** — Scaffold, develop, build, and run with the `lumina` CLI
