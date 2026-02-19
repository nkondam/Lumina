import path from "path";
import fs from "fs";
import * as log from "../utils/logger.js";

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get directory size recursively
 */
function getDirSize(dirPath) {
    let size = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                size += getDirSize(filePath);
            } else {
                size += stat.size;
            }
        }
    } catch {
        // Ignore permission errors
    }
    return size;
}

export async function showCommand(what) {
    console.log();

    const cwd = process.cwd();
    const configPath = path.join(cwd, "lumina.json");

    // Check if we're in a Lumina project
    if (!fs.existsSync(configPath)) {
        // Check if we're in framework root
        const frameworkCheck = path.join(cwd, "sdk-runtime");
        if (fs.existsSync(frameworkCheck)) {
            showFrameworkInfo(cwd);
            return;
        }
        log.error("Not in a Lumina project directory.");
        log.info("Run this command from a directory containing lumina.json");
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    switch (what) {
        case "config":
            showConfig(config);
            break;
        case "routes":
            await showRoutes(cwd, config);
            break;
        case "size":
            showSize(cwd, config);
            break;
        default:
            showProjectInfo(cwd, config);
    }

    console.log();
}

function showFrameworkInfo(cwd) {
    log.box("Lumina Framework", "Framework development environment");
    console.log();
    console.log("  You are in the Lumina framework repository.");
    console.log();
    console.log("  Available modules:");

    const modules = ["cli", "sdk-runtime", "sdk-core", "ui-template", "examples"];
    for (const mod of modules) {
        const modPath = path.join(cwd, mod);
        const exists = fs.existsSync(modPath);
        const icon = exists ? "✓" : "✗";
        const color = exists ? "\x1b[32m" : "\x1b[31m";
        console.log(`    ${color}${icon}\x1b[0m ${mod}`);
    }
    console.log();
}

function showProjectInfo(cwd, config) {
    log.box(`Project: ${config.name}`, config.description || "A Lumina application");
    console.log();

    console.log("  \x1b[1mConfiguration\x1b[0m");
    console.log(`    Name:        ${config.name}`);
    console.log(`    Version:     ${config.version || "0.1.0"}`);
    console.log(`    Backend:     ${config.backend?.language || "java"}`);
    console.log(`    Frontend:    ${config.frontend?.framework || "vanilla"}`);
    console.log();

    // Check for build artifacts
    const buildPath = path.join(cwd, "build");
    const binaryPath = path.join(buildPath, config.name);

    console.log("  \x1b[1mBuild Status\x1b[0m");
    if (fs.existsSync(binaryPath)) {
        const stat = fs.statSync(binaryPath);
        console.log(`    Binary:      ✓ ${formatSize(stat.size)}`);
        console.log(`    Built:       ${stat.mtime.toLocaleString()}`);
    } else {
        console.log("    Binary:      ✗ Not built (run: lumina build)");
    }
    console.log();

    // Show routes if backend dir exists
    const backendPath = path.join(cwd, config.backend?.srcDir || "backend/src");
    if (fs.existsSync(backendPath)) {
        console.log("  \x1b[1mRun\x1b[0m");
        console.log("    lumina dev     Start development server");
        console.log("    lumina build   Build production binary");
        console.log("    lumina run     Run production binary");
    }
}

function showConfig(config) {
    log.box("lumina.json", "Project configuration");
    console.log();
    console.log(JSON.stringify(config, null, 2));
}

async function showRoutes(cwd, config) {
    log.box("Routes", "Registered RPC endpoints");
    console.log();

    const backendSrc = path.join(cwd, config.backend?.srcDir || "backend/src");

    if (!fs.existsSync(backendSrc)) {
        console.log("  No backend source directory found.");
        return;
    }

    // Search for @Route annotations in Java files
    const javaFiles = findFiles(backendSrc, ".java");
    const routes = [];

    for (const file of javaFiles) {
        const content = fs.readFileSync(file, "utf-8");
        const routeMatches = content.matchAll(/@Route\s*\(\s*["']([^"']+)["']\s*\)/g);
        for (const match of routeMatches) {
            routes.push({
                route: match[1],
                file: path.relative(cwd, file),
            });
        }
    }

    if (routes.length === 0) {
        console.log("  No routes found. Add @Route annotations to your handlers.");
        console.log();
        console.log("  Example:");
        console.log('    @Route("tasks/list")');
        console.log("    public static String listTasks(String input) { ... }");
    } else {
        console.log("  Found routes:");
        for (const r of routes) {
            console.log(`    • ${r.route}`);
            console.log(`      └─ ${r.file}`);
        }
    }
}

function showSize(cwd, config) {
    log.box("Project Size", "Disk usage breakdown");
    console.log();

    const dirs = [
        { name: "Frontend", path: config.frontend?.srcDir || "frontend" },
        { name: "Backend", path: config.backend?.srcDir || "backend" },
        { name: "Build", path: "build" },
        { name: "node_modules", path: "frontend/node_modules" },
    ];

    let totalSize = 0;

    for (const dir of dirs) {
        const dirPath = path.join(cwd, dir.path);
        if (fs.existsSync(dirPath)) {
            const size = getDirSize(dirPath);
            totalSize += size;
            console.log(`  ${dir.name.padEnd(15)} ${formatSize(size)}`);
        }
    }

    console.log("  ─────────────────────────");
    console.log(`  ${"Total".padEnd(15)} ${formatSize(totalSize)}`);
}

function findFiles(dir, ext) {
    const results = [];
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                results.push(...findFiles(filePath, ext));
            } else if (file.endsWith(ext)) {
                results.push(filePath);
            }
        }
    } catch {
        // Ignore errors
    }
    return results;
}
