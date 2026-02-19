import path from "path";
import fs from "fs";
import * as log from "../utils/logger.js";

const TEMPLATES = {
  route: {
    description: "Create a new backend route handler",
    generate: generateRoute,
  },
  component: {
    description: "Create a new frontend component",
    generate: generateComponent,
  },
  page: {
    description: "Create a new frontend page",
    generate: generatePage,
  },
};

export async function generateCommand(type, name, options) {
  console.log();

  if (!type) {
    showGenerateHelp();
    return;
  }

  const template = TEMPLATES[type.toLowerCase()];
  if (!template) {
    log.error(`Unknown generator type: ${type}`);
    console.log();
    showGenerateHelp();
    process.exit(1);
  }

  if (!name) {
    log.error(`Please provide a name for the ${type}`);
    console.log(`  Usage: lumina generate ${type} <name>`);
    process.exit(1);
  }

  const cwd = process.cwd();
  const configPath = path.join(cwd, "lumina.json");

  if (!fs.existsSync(configPath)) {
    log.error("Not in a Lumina project directory.");
    log.info("Run this command from a directory containing lumina.json");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  try {
    await template.generate(cwd, config, name, options);
  } catch (error) {
    log.error(`Failed to generate ${type}: ${error.message}`);
    process.exit(1);
  }

  console.log();
}

function showGenerateHelp() {
  log.box("Generate", "Scaffold new files for your Lumina project");
  console.log();
  console.log("  Usage: lumina generate <type> <name>");
  console.log();
  console.log("  Available generators:");
  for (const [name, template] of Object.entries(TEMPLATES)) {
    console.log(`    ${name.padEnd(12)} ${template.description}`);
  }
  console.log();
  console.log("  Examples:");
  console.log("    lumina generate route tasks/create");
  console.log("    lumina generate component TaskCard");
  console.log("    lumina generate page Settings");
  console.log();
}

async function generateRoute(cwd, config, name, options) {
  const backendDir = path.join(cwd, config.backend?.srcDir || "backend/src");
  const packageDir = path.join(backendDir, config.backend?.package?.replace(/\./g, "/") || "");

  // Ensure directory exists
  fs.mkdirSync(packageDir, { recursive: true });

  // Convert route name to class name (e.g., "tasks/create" -> "TasksCreate")
  const className = name
    .split(/[\/\-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const routePath = name.toLowerCase().replace(/[^a-z0-9\/]/g, "/");
  const packageName = config.backend?.package || "app";

  const content = `package ${packageName};

import dev.lumina.runtime.Route;

/**
 * Route handler for ${routePath}
 */
public class ${className}Handler {

    @Route("${routePath}")
    public static String handle(String input) {
        // TODO: Implement ${routePath} handler
        // Parse input JSON, perform logic, return JSON response
        
        return "{\\"status\\": \\"ok\\", \\"route\\": \\"${routePath}\\"}";
    }
}
`;

  const filePath = path.join(packageDir, `${className}Handler.java`);

  if (fs.existsSync(filePath) && !options?.force) {
    log.error(`File already exists: ${filePath}`);
    log.info("Use --force to overwrite");
    process.exit(1);
  }

  fs.writeFileSync(filePath, content);
  log.ok(`Created route handler: ${path.relative(cwd, filePath)}`);
  console.log();
  console.log(`  Route: ${routePath}`);
  console.log(`  Class: ${className}Handler`);
}

async function generateComponent(cwd, config, name, options) {
  const frontendDir = path.join(cwd, config.frontend?.srcDir || "frontend/src");
  const componentsDir = path.join(frontendDir, "components");

  fs.mkdirSync(componentsDir, { recursive: true });

  // Ensure PascalCase
  const componentName = name.charAt(0).toUpperCase() + name.slice(1);
  const componentDir = path.join(componentsDir, componentName);

  fs.mkdirSync(componentDir, { recursive: true });

  // Create JS file
  const jsContent = `/**
 * ${componentName} Component
 */
export class ${componentName} {
  constructor(container, props = {}) {
    this.container = container;
    this.props = props;
    this.state = {};
  }

  render() {
    this.container.innerHTML = \`
      <div class="${componentName.toLowerCase()}">
        <h2>${componentName}</h2>
        <p>Edit this component in components/${componentName}/</p>
      </div>
    \`;
    this.bindEvents();
  }

  bindEvents() {
    // Add event listeners here
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  destroy() {
    // Cleanup
    this.container.innerHTML = '';
  }
}

export function create${componentName}(container, props) {
  const component = new ${componentName}(container, props);
  component.render();
  return component;
}
`;

  // Create CSS file
  const cssContent = `/* ${componentName} Component Styles */
.${componentName.toLowerCase()} {
  /* Component container */
}

.${componentName.toLowerCase()} h2 {
  margin: 0 0 1rem;
}

.${componentName.toLowerCase()} p {
  color: var(--text-secondary, #666);
}
`;

  const jsPath = path.join(componentDir, `${componentName}.js`);
  const cssPath = path.join(componentDir, `${componentName}.css`);

  if ((fs.existsSync(jsPath) || fs.existsSync(cssPath)) && !options?.force) {
    log.error(`Component already exists: ${componentName}`);
    log.info("Use --force to overwrite");
    process.exit(1);
  }

  fs.writeFileSync(jsPath, jsContent);
  fs.writeFileSync(cssPath, cssContent);

  log.ok(`Created component: ${componentName}`);
  console.log();
  console.log(`  Files created:`);
  console.log(`    ${path.relative(cwd, jsPath)}`);
  console.log(`    ${path.relative(cwd, cssPath)}`);
  console.log();
  console.log(`  Usage:`);
  console.log(`    import { create${componentName} } from './components/${componentName}/${componentName}.js';`);
}

async function generatePage(cwd, config, name, options) {
  const frontendDir = path.join(cwd, config.frontend?.srcDir || "frontend/src");
  const pagesDir = path.join(frontendDir, "pages");

  fs.mkdirSync(pagesDir, { recursive: true });

  // Ensure PascalCase
  const pageName = name.charAt(0).toUpperCase() + name.slice(1);
  const pageDir = path.join(pagesDir, pageName);

  fs.mkdirSync(pageDir, { recursive: true });

  const jsContent = `/**
 * ${pageName} Page
 */
export class ${pageName}Page {
  constructor(container) {
    this.container = container;
    this.state = {
      loading: false,
      error: null,
    };
  }

  async init() {
    this.render();
    await this.loadData();
  }

  render() {
    const { loading, error } = this.state;

    this.container.innerHTML = \`
      <div class="${pageName.toLowerCase()}-page">
        <header class="page-header">
          <h1>${pageName}</h1>
        </header>
        
        <main class="page-content">
          \${loading ? '<div class="loading">Loading...</div>' : ''}
          \${error ? \`<div class="error">\${error}</div>\` : ''}
          
          <div class="page-body">
            <p>Welcome to the ${pageName} page.</p>
          </div>
        </main>
      </div>
    \`;

    this.bindEvents();
  }

  bindEvents() {
    // Add event listeners here
  }

  async loadData() {
    this.setState({ loading: true, error: null });
    
    try {
      // TODO: Load page data via RPC
      // const data = await rpc('${pageName.toLowerCase()}/data', {});
      
      this.setState({ loading: false });
    } catch (error) {
      this.setState({ loading: false, error: error.message });
    }
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

export function create${pageName}Page(container) {
  const page = new ${pageName}Page(container);
  page.init();
  return page;
}
`;

  const cssContent = `/* ${pageName} Page Styles */
.${pageName.toLowerCase()}-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.${pageName.toLowerCase()}-page .page-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.${pageName.toLowerCase()}-page .page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.${pageName.toLowerCase()}-page .page-content {
  flex: 1;
  padding: 2rem;
}

.${pageName.toLowerCase()}-page .loading {
  color: var(--text-secondary, #666);
}

.${pageName.toLowerCase()}-page .error {
  color: var(--error-color, #dc3545);
  padding: 1rem;
  background: var(--error-bg, #fff5f5);
  border-radius: 0.5rem;
}
`;

  const jsPath = path.join(pageDir, `${pageName}Page.js`);
  const cssPath = path.join(pageDir, `${pageName}Page.css`);

  if ((fs.existsSync(jsPath) || fs.existsSync(cssPath)) && !options?.force) {
    log.error(`Page already exists: ${pageName}`);
    log.info("Use --force to overwrite");
    process.exit(1);
  }

  fs.writeFileSync(jsPath, jsContent);
  fs.writeFileSync(cssPath, cssContent);

  log.ok(`Created page: ${pageName}`);
  console.log();
  console.log(`  Files created:`);
  console.log(`    ${path.relative(cwd, jsPath)}`);
  console.log(`    ${path.relative(cwd, cssPath)}`);
  console.log();
  console.log(`  Usage:`);
  console.log(`    import { create${pageName}Page } from './pages/${pageName}/${pageName}Page.js';`);
}
