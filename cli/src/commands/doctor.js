import { execSync, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import * as log from "../utils/logger.js";

/**
 * Check if a command exists and return its version
 */
function checkCommand(cmd, versionArg = "--version") {
    try {
        const result = spawnSync(cmd, [versionArg], {
            encoding: "utf-8",
            shell: true,
            timeout: 5000,
        });
        if (result.status === 0) {
            const version = result.stdout?.trim() || result.stderr?.trim() || "installed";
            return { found: true, version: version.split("\n")[0] };
        }
        return { found: false, version: null };
    } catch {
        return { found: false, version: null };
    }
}

/**
 * Check if GraalVM native-image is available
 */
function checkNativeImage() {
    const graalHome = process.env.GRAALVM_HOME || process.env.JAVA_HOME;
    if (!graalHome) {
        return { found: false, version: null, message: "GRAALVM_HOME or JAVA_HOME not set" };
    }

    const nativeImagePath = path.join(graalHome, "bin", "native-image");
    if (!fs.existsSync(nativeImagePath)) {
        return { found: false, version: null, message: "native-image not found in JAVA_HOME/bin" };
    }

    try {
        const result = spawnSync(nativeImagePath, ["--version"], {
            encoding: "utf-8",
            timeout: 10000,
        });
        if (result.status === 0) {
            return { found: true, version: result.stdout?.trim().split("\n")[0] };
        }
        return { found: false, version: null, message: "native-image failed to run" };
    } catch {
        return { found: false, version: null, message: "native-image check failed" };
    }
}

/**
 * Check if we're in a Lumina project
 */
function checkLuminaProject() {
    const configPath = path.join(process.cwd(), "lumina.json");
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            return { found: true, name: config.name || "unknown" };
        } catch {
            return { found: false, error: "Invalid lumina.json" };
        }
    }

    // Check if we're in the framework repo
    const frameworkConfig = path.join(process.cwd(), "sdk-runtime");
    if (fs.existsSync(frameworkConfig)) {
        return { found: true, name: "lumina-framework", isFramework: true };
    }

    return { found: false };
}

export async function doctorCommand() {
    console.log();
    log.box("Lumina Doctor", "Checking your development environment");
    console.log();

    const checks = [];
    let hasErrors = false;

    // Check Node.js
    const node = checkCommand("node", "--version");
    checks.push({
        name: "Node.js",
        status: node.found ? "ok" : "error",
        detail: node.version || "Not found",
        required: true,
    });
    if (!node.found) hasErrors = true;

    // Check npm
    const npm = checkCommand("npm", "--version");
    checks.push({
        name: "npm",
        status: npm.found ? "ok" : "error",
        detail: npm.version || "Not found",
        required: true,
    });
    if (!npm.found) hasErrors = true;

    // Check Java
    const java = checkCommand("java", "-version");
    checks.push({
        name: "Java",
        status: java.found ? "ok" : "error",
        detail: java.version || "Not found (requires 21+)",
        required: true,
    });
    if (!java.found) hasErrors = true;

    // Check GraalVM native-image
    const nativeImage = checkNativeImage();
    checks.push({
        name: "native-image",
        status: nativeImage.found ? "ok" : "warn",
        detail: nativeImage.version || nativeImage.message || "Not found (needed for production builds)",
        required: false,
    });

    // Check CMake
    const cmake = checkCommand("cmake", "--version");
    checks.push({
        name: "CMake",
        status: cmake.found ? "ok" : "warn",
        detail: cmake.version || "Not found (needed for production builds)",
        required: false,
    });

    // Check Gradle
    const gradle = checkCommand("gradle", "--version");
    checks.push({
        name: "Gradle",
        status: gradle.found ? "ok" : "warn",
        detail: gradle.version || "Not found (will use gradlew wrapper)",
        required: false,
    });

    // Check current project
    const project = checkLuminaProject();
    checks.push({
        name: "Lumina Project",
        status: project.found ? "ok" : "info",
        detail: project.found
            ? `${project.name}${project.isFramework ? " (framework)" : ""}`
            : "Not in a Lumina project directory",
        required: false,
    });

    // Display results
    const statusIcons = {
        ok: "✓",
        warn: "⚠",
        error: "✗",
        info: "ℹ",
    };

    const statusColors = {
        ok: "\x1b[32m",
        warn: "\x1b[33m",
        error: "\x1b[31m",
        info: "\x1b[36m",
    };

    const reset = "\x1b[0m";

    for (const check of checks) {
        const icon = statusIcons[check.status];
        const color = statusColors[check.status];
        console.log(`  ${color}${icon}${reset} ${check.name.padEnd(16)} ${check.detail}`);
    }

    console.log();

    if (hasErrors) {
        log.error("Some required dependencies are missing. Please install them to use Lumina.");
        process.exit(1);
    } else {
        log.ok("Your environment is ready for Lumina development!");
    }

    console.log();
}
