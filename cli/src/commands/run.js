import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { detectProject, appPaths, frameworkPaths } from "../utils/paths.js";
import * as log from "../utils/logger.js";

export async function runCommand() {
    const project = detectProject();

    if (!project) {
        log.error("Not inside a Lumina project.");
        log.error("Run from a directory with lumina.json (app) or sdk-core + sdk-runtime (framework).");
        process.exit(1);
    }

    let binaryPath, libPath, projectName;

    if (project.type === "app") {
        const paths = appPaths(project);
        binaryPath = path.join(paths.buildDir, "lumina-host");
        libPath = path.join(paths.sdkRuntime, "build", "native", "nativeCompile");
        projectName = project.config.name || path.basename(paths.appDir);
    } else {
        const paths = frameworkPaths(project.frameworkRoot);
        binaryPath = path.join(paths.buildDir, "lumina-host");
        libPath = path.join(paths.runtimeDir, "build", "native", "nativeCompile");
        projectName = "Lumina Framework";
    }

    if (!fs.existsSync(binaryPath)) {
        log.error("Binary not found. Run 'lumina build' first.");
        log.error(`Expected: ${binaryPath}`);
        process.exit(1);
    }

    if (!fs.existsSync(libPath)) {
        log.error("Native library not found. Run 'lumina build' first.");
        log.error(`Expected: ${libPath}`);
        process.exit(1);
    }

    log.banner(`Running: ${projectName}`);
    console.log();
    console.log(`Binary: ${binaryPath}`);
    console.log();

    const child = spawn(binaryPath, [], {
        cwd: project.type === "app" ? path.dirname(project.configPath) : project.frameworkRoot,
        stdio: "inherit",
        env: {
            ...process.env,
            DYLD_LIBRARY_PATH: libPath,
            LD_LIBRARY_PATH: libPath,  // For Linux
        },
    });

    child.on("error", (err) => {
        log.error("Failed to start: " + err.message);
        process.exit(1);
    });

    child.on("close", (code) => {
        process.exit(code || 0);
    });
}
