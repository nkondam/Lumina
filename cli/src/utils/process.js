import { spawn } from "node:child_process";
import pc from "picocolors";

/**
 * Runs a command and streams output with a colored prefix.
 * Returns a promise that resolves when the process exits with code 0.
 */
export function run(label, color, command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const prefix = pc[color](pc.bold(`[${label}]`)) + " ";
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });

    child.stdout.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line) process.stdout.write(prefix + line + "\n");
      }
    });

    child.stderr.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line) process.stderr.write(prefix + pc.dim(line) + "\n");
      }
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

/**
 * Spawns a long-running process (for dev mode).
 * Returns the ChildProcess so the caller can manage it.
 */
export function spawnDev(label, color, command, args, opts = {}) {
  const prefix = pc[color](pc.bold(`[${label}]`)) + " ";
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });

  child.stdout.on("data", (data) => {
    for (const line of data.toString().split("\n")) {
      if (line) process.stdout.write(prefix + line + "\n");
    }
  });

  child.stderr.on("data", (data) => {
    for (const line of data.toString().split("\n")) {
      if (line) process.stderr.write(prefix + pc.dim(line) + "\n");
    }
  });

  child.on("error", (err) => {
    process.stderr.write(prefix + pc.red("error: " + err.message) + "\n");
  });

  return child;
}

/**
 * Kills a process and waits for it to exit.
 */
export function killProcess(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    child.on("close", resolve);
    child.kill("SIGTERM");
    // Force kill after 3 seconds
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
  });
}
