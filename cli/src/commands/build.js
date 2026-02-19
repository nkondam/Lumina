import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { detectProject, appPaths, frameworkPaths } from "../utils/paths.js";
import { run } from "../utils/process.js";
import * as log from "../utils/logger.js";

export async function buildCommand() {
  const project = detectProject();

  if (!project) {
    log.error("Not inside a Lumina project.");
    log.error("Run from a directory with lumina.json (app) or sdk-core + sdk-runtime (framework).");
    process.exit(1);
  }

  if (project.type === "app") {
    await buildApp(project);
  } else {
    await buildFramework(project);
  }
}

/**
 * Build a Lumina app (has lumina.json)
 */
async function buildApp(project) {
  const paths = appPaths(project);
  const config = project.config;

  log.banner("Lumina App Build");
  console.log(`  App: ${config.name || basename(paths.appDir)}`);
  console.log(`  Framework: ${paths.frameworkRoot}`);
  console.log();

  if (!paths.frameworkRoot || !existsSync(paths.sdkRuntime)) {
    log.error("Lumina framework not found.");
    log.error(`Expected at: ${paths.frameworkRoot}`);
    log.error("Set 'lumina.framework' in lumina.json to the framework path.");
    process.exit(1);
  }

  // ─── Step 1: Build Frontend ──────────────────────────────────────────────
  log.step(1, 3, "Building Frontend (Vite) ...");

  if (!existsSync(paths.frontendDir)) {
    log.error(`Frontend directory not found: ${paths.frontendDir}`);
    process.exit(1);
  }

  await run("vite", "cyan", "npm", ["install", "--silent", "--prefix", paths.frontendDir]);
  await run("vite", "cyan", "npm", ["run", "build", "--prefix", paths.frontendDir]);
  log.success(`Frontend built → ${paths.frontendDir}/dist/`);

  // ─── Step 2: Build Backend (compile app Java with framework) ─────────────
  log.step(2, 3, "Compiling Backend (Java + GraalVM) ...");

  const graalHome = process.env.GRAALVM_HOME || process.env.JAVA_HOME;
  if (!graalHome) {
    log.error("Set GRAALVM_HOME or JAVA_HOME to a GraalVM 21+ distribution.");
    process.exit(1);
  }

  // First, build the SDK jar if not present
  const sdkJar = resolve(paths.sdkRuntime, "build", "libs", "sdk-runtime.jar");
  if (!existsSync(sdkJar)) {
    log.info("Building Lumina SDK jar...");
    await run("gradle", "yellow", paths.gradlew, ["--project-dir", paths.sdkRuntime, "jar"], {
      env: { ...process.env, JAVA_HOME: graalHome },
    });
  }

  // Build the app backend if it has a Gradle build
  const appBuildFile = resolve(paths.backendDir, "build.gradle.kts");
  const appGradlew = existsSync(resolve(paths.backendDir, "gradlew"))
    ? resolve(paths.backendDir, "gradlew")
    : paths.gradlew;

  if (existsSync(appBuildFile)) {
    await run("gradle", "yellow", appGradlew, ["--project-dir", paths.backendDir, "classes"], {
      env: { ...process.env, JAVA_HOME: graalHome },
    });
    log.success("App backend compiled");
  }

  // Build native library (uses framework's native-image config)
  await run("gradle", "yellow", paths.gradlew, ["--project-dir", paths.sdkRuntime, "nativeCompile"], {
    env: { ...process.env, JAVA_HOME: graalHome },
  });

  const nativeLibDir = resolve(paths.sdkRuntime, "build", "native", "nativeCompile");
  log.success(`Native library built → ${nativeLibDir}/`);

  // ─── Step 3: Compile C++ Host ────────────────────────────────────────────
  log.step(3, 3, "Compiling C++ Host ...");

  mkdirSync(paths.buildDir, { recursive: true });

  const sdkCore = resolve(paths.frameworkRoot, "sdk-core");
  const frontendDist = resolve(paths.frontendDir, "dist");

  await run("cmake", "magenta", "cmake", [
    "-S", sdkCore,
    "-B", paths.buildDir,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DSDK_RUNTIME_LIB=${nativeLibDir}`,
    `-DUI_BUILD_DIR=${frontendDist}`,
  ]);

  await run("cmake", "magenta", "cmake", [
    "--build", paths.buildDir,
    "--config", "Release",
  ]);

  // ─── Done ────────────────────────────────────────────────────────────────
  console.log();
  log.banner("Build complete!");

  const binaryPath = resolve(paths.buildDir, "lumina-host");
  log.info(`Binary: ${binaryPath}`);
  log.info(`Run:    lumina run`);
}

/**
 * Build the Lumina framework itself (for framework development)
 */
async function buildFramework(project) {
  const root = project.frameworkRoot;
  const paths = frameworkPaths(root);

  log.banner("Lumina Framework Build");

  // ─── Step 1: Build UI ───────────────────────────────────────────────────
  log.step(1, 3, "Building UI (Vite) ...");
  await run("vite", "cyan", "npm", ["install", "--silent", "--prefix", paths.uiDir]);
  await run("vite", "cyan", "npm", ["run", "build", "--prefix", paths.uiDir]);
  log.success(`UI built → ${paths.uiDir}/dist/`);

  // ─── Step 2: Compile Java to native shared library ───────────────────────
  log.step(2, 3, "Compiling Java → native shared library (GraalVM) ...");

  const graalHome = process.env.GRAALVM_HOME || process.env.JAVA_HOME;
  if (!graalHome) {
    log.error("Set GRAALVM_HOME or JAVA_HOME to a GraalVM 21+ distribution.");
    process.exit(1);
  }

  await run("gradle", "yellow", paths.gradlew, ["--project-dir", paths.runtimeDir, "nativeCompile"], {
    env: { ...process.env, JAVA_HOME: graalHome },
  });

  const nativeLibDir = resolve(paths.runtimeDir, "build", "native", "nativeCompile");
  log.success(`Native library built → ${nativeLibDir}/`);

  // ─── Step 3: Compile C++ host ───────────────────────────────────────────
  log.step(3, 3, "Compiling C++ host ...");
  mkdirSync(paths.buildDir, { recursive: true });

  await run("cmake", "magenta", "cmake", [
    "-S", paths.coreDir,
    "-B", paths.buildDir,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DSDK_RUNTIME_LIB=${nativeLibDir}`,
    `-DUI_BUILD_DIR=${paths.uiDir}/dist`,
  ]);

  await run("cmake", "magenta", "cmake", [
    "--build", paths.buildDir,
    "--config", "Release",
  ]);

  console.log();
  log.banner("Build complete!");
  log.info(`Binary: ${paths.buildDir}/lumina-host`);
  log.info(`Run:    DYLD_LIBRARY_PATH=${nativeLibDir} ${paths.buildDir}/lumina-host`);
}
