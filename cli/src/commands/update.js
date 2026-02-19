import { execSync } from "child_process";
import * as log from "../utils/logger.js";

export async function updateCommand() {
    console.log();
    log.box("Lumina Update", "Updating Lumina CLI to the latest version");
    console.log();

    try {
        log.info("Checking for updates...");

        // Get current version
        const packageJson = await import("../../package.json", { assert: { type: "json" } });
        const currentVersion = packageJson.default.version;
        log.info(`Current version: ${currentVersion}`);

        // Check npm for latest version
        try {
            const latestVersion = execSync("npm show lumina-cli version 2>/dev/null", {
                encoding: "utf-8",
            }).trim();

            if (latestVersion && latestVersion !== currentVersion) {
                log.info(`Latest version: ${latestVersion}`);
                log.info("Updating...");

                execSync("npm install -g lumina-cli@latest", {
                    stdio: "inherit",
                });

                log.ok(`Successfully updated to ${latestVersion}!`);
            } else {
                log.ok("You're already on the latest version!");
            }
        } catch {
            // Package not published to npm yet, check local update
            log.warn("Lumina CLI is not published to npm yet.");
            log.info("To update, pull the latest changes and run:");
            console.log();
            console.log("  cd /path/to/lumina");
            console.log("  git pull");
            console.log("  npm install -g ./cli");
            console.log();
        }
    } catch (error) {
        log.error(`Update failed: ${error.message}`);
        process.exit(1);
    }

    console.log();
}
