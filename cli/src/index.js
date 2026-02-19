import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";
import { runCommand } from "./commands/run.js";
import { doctorCommand } from "./commands/doctor.js";
import { updateCommand } from "./commands/update.js";
import { showCommand } from "./commands/show.js";
import { generateCommand } from "./commands/generate.js";

const program = new Command();

program
  .name("lumina")
  .description("CLI for Lumina desktop app framework")
  .version("0.1.0");

program
  .command("version")
  .description("Output the version number")
  .action(() => {
    console.log("0.1.0");
  });

program
  .command("init")
  .description("Scaffold a new Lumina project")
  .argument("[name]", "Project name")
  .action(initCommand);

program
  .command("dev")
  .description("Start dev mode (Vite + Java DevServer + webview)")
  .action(devCommand);

program
  .command("build")
  .description("Build production binary (UI → native-image → C++ link)")
  .action(buildCommand);

program
  .command("run")
  .description("Run the production binary")
  .action(runCommand);

program
  .command("doctor")
  .description("Check your development environment")
  .action(doctorCommand);

program
  .command("update")
  .description("Update Lumina CLI to the latest version")
  .action(updateCommand);

program
  .command("show")
  .description("Show project info, config, routes, or size")
  .argument("[what]", "What to show: config, routes, size (default: project info)")
  .action(showCommand);

program
  .command("generate")
  .alias("g")
  .description("Generate routes, components, or pages")
  .argument("[type]", "Type: route, component, page")
  .argument("[name]", "Name for the generated item")
  .option("-f, --force", "Overwrite existing files")
  .action(generateCommand);

program.parse();

