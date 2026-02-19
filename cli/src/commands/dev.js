import { existsSync } from "node:fs";
import { exec } from "node:child_process";

function openBrowser(url) {
  const start = process.platform == "darwin" ? "open" : process.platform == "win32" ? "start" : "xdg-open";
  exec(`${start} ${url}`);
}
import { resolve, basename } from "node:path";
import { detectProject, appPaths, frameworkPaths } from "../utils/paths.js";
import { spawnDev, killProcess } from "../utils/process.js";
import * as log from "../utils/logger.js";

export async function devCommand() {
  const project = detectProject();

  if (!project) {
    log.error("Not inside a Lumina project.");
    log.error("Run from a directory with lumina.json (app) or sdk-core + sdk-runtime (framework).");
    process.exit(1);
  }

  if (project.type === "app") {
    await devApp(project);
  } else {
    await devFramework(project);
  }
}

/**
 * Dev mode for a Lumina app (has lumina.json)
 */
async function devApp(project) {
  const paths = appPaths(project);
  const config = project.config;
  const children = [];

  log.banner("Lumina Dev Mode - App");
  console.log(`  App: ${config.name || basename(paths.appDir)}`);
  console.log();

  // Graceful shutdown handler
  const cleanup = async () => {
    console.log();
    log.info("Shutting down...");
    await Promise.all(children.map(killProcess));
    log.success("All processes stopped.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // ─── 1. Start Frontend dev server ────────────────────────────────────────
  log.info("Starting Frontend (Vite) ...");
  const vite = spawnDev("vite", "cyan", "npx", ["vite", "--host"], {
    cwd: paths.frontendDir,
  });
  children.push(vite);

  // ─── 2. Start Backend (Java DevServer with app routes) ──────────────────
  log.info("Starting Backend (Java DevServer) ...");

  // Run the app's backend (which depends on the framework)
  // We use the framework's gradlew wrapper
  const java = spawnDev("java", "yellow", paths.gradlew, ["--project-dir", paths.backendDir, "run", "-q"], {
    env: { ...process.env },
  });
  children.push(java);

  // ─── 3. Start native webview (if binary exists) ──────────────────────────
  const hostBin = resolve(paths.buildDir, "lumina-host");
  if (existsSync(hostBin)) {
    await new Promise((r) => setTimeout(r, 2000));

    log.info("Starting native webview (dev mode) ...");
    const nativeLibDir = resolve(paths.sdkRuntime, "build", "native", "nativeCompile");
    const webview = spawnDev("webview", "magenta", hostBin, ["--dev"], {
      env: {
        ...process.env,
        DYLD_LIBRARY_PATH: nativeLibDir,
        LD_LIBRARY_PATH: nativeLibDir,
      },
    });
    children.push(webview);

    webview.on("close", () => {
      log.info("Webview closed. Shutting down...");
      cleanup();
    });
  } else {
    console.log();
    log.warn("lumina-host binary not found. Opening in default browser...");
    log.warn(`To build the native host, run: lumina build`);

    setTimeout(() => {
      openBrowser("http://localhost:5173");
    }, 2000);
  }

  console.log();
  log.success("Dev mode running. Press Ctrl+C to stop.");
}

/**
 * Dev mode for framework development
 */
async function devFramework(project) {
  const root = project.frameworkRoot;
  const paths = frameworkPaths(root);
  const children = [];

  log.banner("Lumina Dev Mode");
  console.log();

  // Graceful shutdown handler
  const cleanup = async () => {
    console.log();
    log.info("Shutting down...");
    await Promise.all(children.map(killProcess));
    log.success("All processes stopped.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // ─── 1. Start Vite dev server ──────────────────────────────────────────
  log.info("Starting Vite dev server ...");
  const vite = spawnDev("vite", "cyan", "npx", ["vite", "--host"], {
    cwd: paths.uiDir,
  });
  children.push(vite);

  // ─── 2. Start Java DevServer ──────────────────────────────────────────
  log.info("Starting Java DevServer ...");
  const java = spawnDev("java", "yellow", paths.gradlew, ["--project-dir", paths.runtimeDir, "run", "-q"], {
    env: { ...process.env },
  });
  children.push(java);

  // ─── 3. Start native webview (if binary exists) ───────────────────────
  const hostBin = resolve(paths.buildDir, "lumina-host");
  if (existsSync(hostBin)) {
    // Wait a moment for Vite to start before launching webview
    await new Promise((r) => setTimeout(r, 2000));

    log.info("Starting native webview (dev mode) ...");
    const nativeLibDir = resolve(paths.runtimeDir, "build", "native", "nativeCompile");
    const webview = spawnDev("webview", "magenta", hostBin, ["--dev"], {
      env: {
        ...process.env,
        DYLD_LIBRARY_PATH: nativeLibDir,
        LD_LIBRARY_PATH: nativeLibDir,
      },
    });
    children.push(webview);

    webview.on("close", () => {
      log.info("Webview closed. Shutting down...");
      cleanup();
    });
  } else {
    console.log();
    log.warn("lumina-host binary not found. Opening in default browser...");
    log.warn(`To build the native host, run: lumina build`);

    setTimeout(() => {
      openBrowser("http://localhost:5173");
    }, 2000);
  }

  console.log();
  log.success("Dev mode running. Press Ctrl+C to stop.");
}
