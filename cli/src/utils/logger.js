import pc from "picocolors";

export function info(msg) {
  console.log(pc.cyan("info") + "  " + msg);
}

export function success(msg) {
  console.log(pc.green("ok") + "    " + msg);
}

export function ok(msg) {
  console.log(pc.green("ok") + "    " + msg);
}

export function warn(msg) {
  console.log(pc.yellow("warn") + "  " + msg);
}

export function error(msg) {
  console.error(pc.red("error") + " " + msg);
}

export function step(num, total, msg) {
  console.log(pc.bold(`[${num}/${total}]`) + " " + msg);
}

export function banner(text) {
  const line = "═".repeat(52);
  console.log(pc.bold(line));
  console.log(pc.bold(" " + text));
  console.log(pc.bold(line));
}

export function box(title, subtitle = "") {
  const line = "═".repeat(52);
  console.log(pc.bold(line));
  console.log(pc.bold(" " + title));
  if (subtitle) {
    console.log(pc.dim(" " + subtitle));
  }
  console.log(pc.bold(line));
}

