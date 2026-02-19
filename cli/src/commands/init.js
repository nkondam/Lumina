import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import * as log from "../utils/logger.js";
import prompts from "prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function initCommand(nameArg) {
  let result = await prompts(
    [
      {
        type: nameArg ? null : "text",
        name: "projectName",
        message: "Project name:",
        initial: "my-lumina-app",
      },
      {
        type: "select",
        name: "backendLanguage",
        message: "Select a backend language:",
        choices: [
          { title: "Java", value: "java" },
          { title: "Kotlin", value: "kotlin" },
          { title: "Scala", value: "scala" },
        ],
        initial: 0,
      },
      {
        type: "select",
        name: "packageManager",
        message: "Select a package manager:",
        choices: [
          { title: "npm", value: "npm" },
          { title: "pnpm", value: "pnpm" },
          { title: "yarn", value: "yarn" },
          { title: "bun", value: "bun" },
        ],
        initial: 0,
      },
      {
        type: "select",
        name: "framework",
        message: "Select a UI framework:",
        choices: [
          { title: "Vanilla", value: "vanilla" },
          { title: "Vue", value: "vue" },
          { title: "React", value: "react" },
          { title: "Svelte", value: "svelte" },
          { title: "Solid", value: "solid" },
          { title: "Preact", value: "preact" },
          { title: "Lit", value: "lit" },
        ],
        initial: 0,
      },
      {
        type: "select",
        name: "variant",
        message: "Select a variant:",
        choices: [
          { title: "TypeScript", value: "ts" },
          { title: "JavaScript", value: "js" },
        ],
        initial: 0,
      },
    ],
    {
      onCancel: () => {
        log.error("Operation cancelled");
        process.exit(0);
      },
    }
  );

  const name = nameArg || result.projectName;
  const pm = result.packageManager;
  const backendLang = result.backendLanguage;
  const framework = result.framework;
  const variant = result.variant;
  const template = variant === "ts" ? `${framework}-ts` : framework;

  const targetDir = resolve(process.cwd(), name);

  if (existsSync(targetDir)) {
    log.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  // Find the Lumina framework root
  let frameworkRoot = process.env.LUMINA_HOME;

  if (!frameworkRoot) {
    // Try relative to CLI source (development mode or standard layout)
    // __dirname is .../cli/src/commands
    const relRoot = resolve(__dirname, "..", "..", "..");
    if (existsSync(resolve(relRoot, "sdk-core"))) {
      frameworkRoot = relRoot;
    }
  }

  if (!frameworkRoot || !existsSync(resolve(frameworkRoot, "sdk-core"))) {
    log.error("Could not find Lumina framework root.");
    log.error("Please set LUMINA_HOME environment variable to the framework directory.");
    process.exit(1);
  }

  console.log();
  log.banner("Lumina Init");
  log.info(`Creating app "${name}" ...`);
  console.log();

  // Create directory structure
  mkdirSync(targetDir, { recursive: true });

  // ─── Backend Generation ──────────────────────────────────────────────────
  log.info(`Generating Backend (${backendLang})...`);
  const mainClass = generateBackend(targetDir, name, frameworkRoot, backendLang);
  log.success("Created backend/");

  // ─── Frontend Generation (create-vite) ───────────────────────────────────
  log.info(`Generating Frontend (${template})...`);

  const createCmd = "npm create vite@latest frontend -- --template " + template;

  try {
    execSync(createCmd, { cwd: targetDir, stdio: "ignore" });
  } catch (e) {
    log.error("Failed to generate frontend with create-vite.");
    console.error(e);
    process.exit(1);
  }

  // Inject Lumina Bridge
  injectLuminaBridge(targetDir, framework, variant);

  // Inject Lumina Logo
  injectLuminaLogo(targetDir);

  log.success("Created frontend/");

  // ─── lumina.json ─────────────────────────────────────────────────────────
  const luminaConfig = {
    name: name,
    version: "1.0.0",
    description: `A cross-platform desktop app built with Lumina`,
    lumina: {
      framework: frameworkRoot,
      frontend: {
        dir: "frontend",
        entry: "index.html",
      },
      backend: {
        dir: "backend",
        mainClass: mainClass,
      },
    },
  };
  writeFileSync(
    resolve(targetDir, "lumina.json"),
    JSON.stringify(luminaConfig, null, 2) + "\n"
  );
  log.success("Created lumina.json");

  // ─── Install Dependencies ────────────────────────────────────────────────
  log.info(`Installing frontend dependencies with ${pm}...`);
  try {
    const installCmd = pm === "npm" ? "npm install" : `${pm} install`;
    execSync(installCmd, { cwd: resolve(targetDir, "frontend"), stdio: "ignore" });
    log.success("Frontend dependencies installed");
  } catch {
    log.warn(`Could not install dependencies. Run: cd frontend && ${pm} install`);
  }

  // ─── Done ────────────────────────────────────────────────────────────────
  console.log();
  log.banner("App created!");
  console.log();
  console.log(`  cd ${name}`);
  console.log(`  lumina dev     # Start development mode`);
  console.log(`  lumina build   # Build production binary`);
  console.log(`  lumina run     # Run production binary`);
  console.log();
}

function generateBackend(targetDir, name, frameworkRoot, lang) {
  const backendDir = resolve(targetDir, "backend");
  const appPackage = "app";
  const appClass = `${capitalize(name)}App`;

  let srcPath;
  let mainClassStr;

  // Setup Gradle Plugins & Deps
  let plugins = [];
  let deps = [];
  let mainFile;
  let mainContent;

  if (lang === "kotlin") {
    // KOTLIN
    srcPath = resolve(backendDir, "src", "main", "kotlin", appPackage);
    plugins = [`id("java")`, `id("application")`, `kotlin("jvm") version "1.9.22"`];
    deps = [`implementation(kotlin("stdlib"))`];
    // In Kotlin, top-level functions are compiled to a class named FilenameKt
    mainClassStr = `${appPackage}.${appClass}Kt`;
    mainFile = `${appClass}.kt`;
    mainContent = generateKotlinApp(appPackage, name);

  } else if (lang === "scala") {
    // SCALA
    srcPath = resolve(backendDir, "src", "main", "scala", appPackage);
    plugins = [`id("java")`, `id("application")`, `id("scala")`];
    deps = [`implementation("org.scala-lang:scala-library:2.13.12")`];
    mainClassStr = `${appPackage}.${appClass}`;
    mainFile = `${appClass}.scala`;
    mainContent = generateScalaApp(appPackage, appClass, name);

  } else {
    // JAVA (Default)
    srcPath = resolve(backendDir, "src", "main", "java", appPackage);
    plugins = [`id("java")`, `id("application")`];
    mainClassStr = `${appPackage}.${appClass}`;
    mainFile = `${appClass}.java`;
    mainContent = generateJavaApp(appPackage, appClass, name);
  }

  mkdirSync(srcPath, { recursive: true });
  writeFileSync(resolve(srcPath, mainFile), mainContent);

  // build.gradle.kts
  const buildGradle = `plugins {
    ${plugins.join("\n    ")}
}

group = "${appPackage}"
version = "1.0.0"

repositories {
    mavenCentral()
}

// Path to Lumina framework
val luminaFramework = file("${frameworkRoot.replace(/\\/g, "/")}")
val sdkLibsDir = luminaFramework.resolve("sdk-runtime/build/libs")

dependencies {
    implementation(fileTree(sdkLibsDir) { include("*.jar") })
    ${deps.join("\n    ")}
}

application {
    mainClass.set("${mainClassStr}")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.named("compileJava") {
    doFirst {
        val jars = sdkLibsDir.listFiles()?.filter { it.extension == "jar" } ?: emptyList()
        if (jars.isEmpty()) {
            throw GradleException(
                "Lumina SDK jar not found in: $sdkLibsDir\\n" +
                "Run 'cd $luminaFramework/sdk-runtime && ./gradlew jar' first."
            )
        }
    }
}
`;
  writeFileSync(resolve(backendDir, "build.gradle.kts"), buildGradle);

  // settings.gradle.kts
  writeFileSync(
    resolve(backendDir, "settings.gradle.kts"),
    `rootProject.name = "${name}"\n`
  );

  return mainClassStr;
}

function generateJavaApp(pkg, cls, name) {
  return `package ${pkg};

import dev.lumina.runtime.DevServer;
import java.util.function.Function;

public class ${cls} {

    public static void main(String[] args) throws Exception {
        System.out.println("Starting ${name} (Java)...");
        registerRoutes(DevServer::route);
        DevServer.main(args);
    }

    public static void registerRoutes(
            java.util.function.BiConsumer<String, Function<String, String>> register) {
        
        register.accept("greet", payload -> {
            String name = extractString(payload, "name");
            if (name == null || name.isBlank()) name = "World";
            return "{\\"message\\":\\"Hello, " + name + "! (from Java)\\"}";
        });
    }

    private static String extractString(String json, String key) {
        String search = "\\"" + key + "\\"";
        int keyIdx = json.indexOf(search);
        if (keyIdx < 0) return null;
        int colonIdx = json.indexOf(':', keyIdx + search.length());
        if (colonIdx < 0) return null;
        int openQuote = json.indexOf('"', colonIdx + 1);
        if (openQuote < 0) return null;
        int closeQuote = json.indexOf('"', openQuote + 1);
        if (closeQuote < 0) return null;
        return json.substring(openQuote + 1, closeQuote);
    }
}
`;
}

function generateKotlinApp(pkg, name) {
  return `package ${pkg}

import dev.lumina.runtime.DevServer
import java.util.function.BiConsumer
import java.util.function.Function

fun main(args: Array<String>) {
    println("Starting ${name} (Kotlin)...")
    registerRoutes(DevServer::route)
    DevServer.main(args)
}

fun registerRoutes(register: BiConsumer<String, Function<String, String>>) {
    register.accept("greet") { payload ->
        val name = extractString(payload, "name") ?: "World"
        """{"message": "Hello, $name! (from Kotlin)"}"""
    }
}

fun extractString(json: String, key: String): String? {
    val search = "\\"$key\\""
    val keyIdx = json.indexOf(search)
    if (keyIdx < 0) return null
    val colonIdx = json.indexOf(':', keyIdx + search.length)
    if (colonIdx < 0) return null
    val openQuote = json.indexOf('"', colonIdx + 1)
    if (openQuote < 0) return null
    val closeQuote = json.indexOf('"', openQuote + 1)
    if (closeQuote < 0) return null
    return json.substring(openQuote + 1, closeQuote)
}
`;
}

function generateScalaApp(pkg, cls, name) {
  return `package ${pkg}

import dev.lumina.runtime.DevServer
import java.util.function.{BiConsumer, Function}

object ${cls} {

  def main(args: Array[String]): Unit = {
    println(s"Starting ${name} (Scala)...")
    registerRoutes(DevServer.route)
    DevServer.main(args)
  }

  def registerRoutes(register: BiConsumer[String, Function[String, String]]): Unit = {
    register.accept("greet", (payload: String) => {
      val name = extractString(payload, "name").getOrElse("World")
      s"""{"message": "Hello, $name! (from Scala)"}"""
    })
  }

  def extractString(json: String, key: String): Option[String] = {
    val search = s"\\"$key\\""
    val keyIdx = json.indexOf(search)
    if (keyIdx < 0) return None
    val colonIdx = json.indexOf(':', keyIdx + search.length)
    if (colonIdx < 0) return None
    val openQuote = json.indexOf('"', colonIdx + 1)
    if (openQuote < 0) return None
    val closeQuote = json.indexOf('"', openQuote + 1)
    if (closeQuote < 0) return None
    Some(json.substring(openQuote + 1, closeQuote))
  }
}
`;
}

function injectLuminaBridge(targetDir, framework, variant) {
  const frontendDir = resolve(targetDir, "frontend");
  let srcDir = resolve(frontendDir, "src");

  // Handle projects without src/ directory (e.g. vanilla JS)
  if (!existsSync(srcDir)) {
    srcDir = frontendDir;
  }

  // 1. Create bridge file
  const isTs = variant === "ts";
  const bridgeExt = isTs ? "ts" : "js";
  const bridgeFile = resolve(srcDir, `lumina.${bridgeExt}`);

  const bridgeContent = `// Lumina IPC bridge
// This file is auto-injected in production but needed for dev 

${isTs ? "declare global {\n  interface Window {\n    lumina: {\n      send: (route: string, payload?: any) => Promise<any>;\n    };\n  }\n}\n" : ""}

// Dev mode polyfill
if (!window.lumina) {
  window.lumina = {
    send: async (route${isTs ? ": string" : ""}, payload${isTs ? "?: any" : ""}) => {
      const body = typeof payload === "string" ? payload : JSON.stringify(payload || {});
      const res = await fetch("http://localhost:8080/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, payload: body }),
      });
      return res.json();
    },
  };
}

export default window.lumina;
`;

  writeFileSync(bridgeFile, bridgeContent);

  // 2. Inject import into main entry file
  const extensions = ["ts", "tsx", "js", "jsx"];
  let entryFile = null;

  for (const ext of extensions) {
    const f = resolve(srcDir, `main.${ext}`);
    if (existsSync(f)) {
      entryFile = f;
      break;
    }
  }

  if (!entryFile) {
    // Try index.*
    for (const ext of extensions) {
      const f = resolve(srcDir, `index.${ext}`);
      if (existsSync(f)) {
        entryFile = f;
        break;
      }
    }
  }

  if (entryFile) {
    const content = readFileSync(entryFile, "utf-8");
    const importStmt = `import './lumina';\n`;
    if (!content.includes("./lumina")) {
      writeFileSync(entryFile, importStmt + content);
    }
  }
}

function injectLuminaLogo(targetDir) {
  const frontendDir = resolve(targetDir, "frontend");
  // Try to find public directory
  const publicDir = resolve(frontendDir, "public");

  if (!existsSync(publicDir)) {
    // If no public dir, try to put it in root or src/assets?
    // Most frameworks use public. If not, just skip or create public.
    mkdirSync(publicDir, { recursive: true });
  }

  const logoSvg = `<svg width="256" height="256" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 4L58 19V49L32 64L6 49V19L32 4Z" fill="url(#grad_l)" fill-opacity="0.1" stroke="url(#grad_l)" stroke-width="2"/>
  <path d="M32 30L56 18" stroke="url(#grad_l)" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 30L8 18" stroke="url(#grad_l)" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 30V58" stroke="url(#grad_l)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="30" r="4" fill="#fff" />
  <defs>
    <linearGradient id="grad_l" x1="6" y1="4" x2="58" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#60A5FA"/>
      <stop offset="1" stop-color="#A78BFA"/>
    </linearGradient>
  </defs>
</svg>`;

  writeFileSync(resolve(publicDir, "lumina.svg"), logoSvg);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
