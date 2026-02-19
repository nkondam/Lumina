import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Project types:
 * - "app": A Lumina application (has lumina.json)
 * - "framework": The Lumina framework itself (has sdk-core + sdk-runtime)
 */

/**
 * Finds a lumina.json config file, walking up from cwd.
 * Returns the path to lumina.json or null if not found.
 */
export function findAppConfig(from = process.cwd()) {
  let dir = resolve(from);
  while (true) {
    const configPath = resolve(dir, "lumina.json");
    if (existsSync(configPath)) {
      return configPath;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Loads and parses the lumina.json config.
 */
export function loadAppConfig(configPath) {
  const content = readFileSync(configPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Walks up from cwd looking for the Lumina framework root.
 * Identified by the presence of sdk-core/ and sdk-runtime/ directories.
 */
export function findFrameworkRoot(from = process.cwd()) {
  let dir = resolve(from);
  while (true) {
    if (
      existsSync(resolve(dir, "sdk-core")) &&
      existsSync(resolve(dir, "sdk-runtime"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Detect project type and return appropriate context.
 * Priority: app (lumina.json) > framework (sdk-core + sdk-runtime)
 */
export function detectProject(from = process.cwd()) {
  // First, check for a Lumina app (lumina.json)
  const appConfigPath = findAppConfig(from);
  if (appConfigPath) {
    const appDir = dirname(appConfigPath);
    const config = loadAppConfig(appConfigPath);

    // Resolve framework path
    let frameworkRoot = null;
    if (config.lumina?.framework) {
      frameworkRoot = resolve(appDir, config.lumina.framework);
    } else {
      // Look for framework in parent directories or node_modules
      frameworkRoot = findFrameworkRoot(appDir);
    }

    return {
      type: "app",
      appDir,
      config,
      configPath: appConfigPath,
      frameworkRoot,
    };
  }

  // Otherwise, check for framework development
  const frameworkRoot = findFrameworkRoot(from);
  if (frameworkRoot) {
    return {
      type: "framework",
      appDir: null,
      config: null,
      configPath: null,
      frameworkRoot,
    };
  }

  return null;
}

/**
 * Legacy: Walks up from cwd looking for the Lumina project root.
 * @deprecated Use detectProject() instead
 */
export function findProjectRoot(from = process.cwd()) {
  const project = detectProject(from);
  return project?.frameworkRoot || null;
}

/**
 * Returns paths for a Lumina app project.
 */
export function appPaths(project) {
  const { appDir, config, frameworkRoot } = project;

  return {
    appDir,
    frameworkRoot,
    frontendDir: resolve(appDir, config.lumina?.frontend?.dir || "frontend"),
    backendDir: resolve(appDir, config.lumina?.backend?.dir || "backend"),
    buildDir: resolve(appDir, "build"),
    distDir: resolve(appDir, "dist"),
    // Framework paths
    sdkRuntime: resolve(frameworkRoot, "sdk-runtime"),
    sdkCore: resolve(frameworkRoot, "sdk-core"),
    gradlew: resolve(frameworkRoot, "sdk-runtime", "gradlew"),
  };
}

/**
 * Returns paths for framework development.
 */
export function frameworkPaths(root) {
  return {
    root,
    uiDir: resolve(root, "ui-template"),
    runtimeDir: resolve(root, "sdk-runtime"),
    coreDir: resolve(root, "sdk-core"),
    buildDir: resolve(root, "build"),
    scriptsDir: resolve(root, "scripts"),
    gradlew: resolve(root, "sdk-runtime", "gradlew"),
  };
}

/**
 * Legacy: Returns an object with all computed paths for the project.
 * @deprecated Use appPaths() or frameworkPaths() instead
 */
export function projectPaths(root) {
  return frameworkPaths(root);
}
