#!/usr/bin/env npx tsx
/**
 * Shared script for generating embedded documentation for Mastra packages.
 *
 * Usage:
 *   pnpm generate:docs                     # Generate for all packages with docs.config.json
 *   pnpm generate:docs packages/core       # Generate for a specific package
 *   pnpm generate:docs stores/libsql       # Generate for a store package
 *
 * Each package should have a docs.config.json file defining its documentation sources.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.join(__dirname, '..');
const MDX_DOCS_DIR = path.join(MONOREPO_ROOT, 'docs/src/content/en');

// ============================================================================
// Types
// ============================================================================

interface ExportInfo {
  types: string;
  implementation: string;
  line?: number;
}

interface ModuleInfo {
  index: string;
  chunks: string[];
}

interface SourceMap {
  version: string;
  package: string;
  exports: Record<string, ExportInfo>;
  modules: Record<string, ModuleInfo>;
}

interface DocTopic {
  id: string;
  title: string;
  sourceFiles: string[];
  /** Optional code references to link to implementation (e.g., ['Agent', 'MessageList']) */
  codeReferences?: string[];
}

interface DocsConfig {
  /** Skill name for Claude Skills (derived from package name if not provided) */
  skillName?: string;
  /** Description for Claude Skills */
  skillDescription?: string;
  /** Modules to analyze in dist/ for SOURCE_MAP */
  modules?: string[];
  /** Documentation topics */
  topics: DocTopic[];
}

/**
 * Extract code references from MDX content by finding:
 * - Import statements: import { Agent, Tool } from "@mastra/..."
 * - Inline code references: `Agent`, `createTool()`
 */
function extractCodeReferencesFromContent(content: string, sourceMap: SourceMap): string[] {
  const discovered = new Set<string>();
  const exportNames = Object.keys(sourceMap.exports);

  // 1. Parse import statements: import { Agent, Tool } from "@mastra/..."
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']@mastra\/[^"']+["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
    for (const name of names) {
      if (exportNames.includes(name)) {
        discovered.add(name);
      }
    }
  }

  // 2. Find inline code references: `Agent`, `createTool`, etc.
  const inlineCodeRegex = /`([A-Z][a-zA-Z]*)`/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const name = match[1];
    if (exportNames.includes(name)) {
      discovered.add(name);
    }
  }

  // 3. Find function calls in code blocks: new Agent(, createTool(
  const functionCallRegex = /(?:new\s+)?([A-Z][a-zA-Z]*)\s*\(/g;
  while ((match = functionCallRegex.exec(content)) !== null) {
    const name = match[1];
    if (exportNames.includes(name)) {
      discovered.add(name);
    }
  }

  return [...discovered];
}

function getTopicCodeReferences(topic: DocTopic, sourceMap: SourceMap, topicContent: string): [string, ExportInfo][] {
  // Use explicit codeReferences if provided, otherwise auto-discover from content
  const names = topic.codeReferences || extractCodeReferencesFromContent(topicContent, sourceMap);
  return names
    .filter(name => sourceMap.exports[name])
    .map(name => [name, sourceMap.exports[name]] as [string, ExportInfo]);
}

// ============================================================================
// Source Map Generator
// ============================================================================

function parseIndexExports(indexPath: string): Map<string, { chunk: string; exportName: string }> {
  const exports = new Map<string, { chunk: string; exportName: string }>();

  if (!fs.existsSync(indexPath)) {
    return exports;
  }

  const content = fs.readFileSync(indexPath, 'utf-8');

  // Parse: export { Agent, TripWire } from '../chunk-IDD63DWQ.js';
  const regex = /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(' as ')[0].trim());
    const chunkPath = match[2];
    const chunk = path.basename(chunkPath);

    for (const name of names) {
      if (name) {
        exports.set(name, { chunk, exportName: name });
      }
    }
  }

  return exports;
}

function findExportLine(chunkPath: string, exportName: string): number | undefined {
  if (!fs.existsSync(chunkPath)) {
    return undefined;
  }

  const content = fs.readFileSync(chunkPath, 'utf-8');
  const lines = content.split('\n');

  // Look for class or function definition
  const patterns = [
    new RegExp(`^var ${exportName} = class`),
    new RegExp(`^function ${exportName}\\s*\\(`),
    new RegExp(`^var ${exportName} = function`),
    new RegExp(`^var ${exportName} = \\(`), // Arrow function
    new RegExp(`^const ${exportName} = `),
    new RegExp(`^let ${exportName} = `),
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(lines[i])) {
        return i + 1; // 1-indexed
      }
    }
  }

  return undefined;
}

function generateSourceMap(packageRoot: string, config: DocsConfig): SourceMap {
  const distDir = path.join(packageRoot, 'dist');
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));

  const sourceMap: SourceMap = {
    version: packageJson.version,
    package: packageJson.name,
    exports: {},
    modules: {},
  };

  // Default modules to analyze, can be overridden in config
  const modules = config.modules || [
    'agent',
    'tools',
    'workflows',
    'memory',
    'stream',
    'llm',
    'mastra',
    'mcp',
    'evals',
    'processors',
    'storage',
    'vector',
    'voice',
  ];

  for (const mod of modules) {
    const indexPath = path.join(distDir, mod, 'index.js');

    if (!fs.existsSync(indexPath)) {
      continue;
    }

    const exports = parseIndexExports(indexPath);
    const chunks = new Set<string>();

    for (const [name, info] of exports) {
      chunks.add(info.chunk);

      const chunkPath = path.join(distDir, info.chunk);
      const line = findExportLine(chunkPath, name);

      // Determine the types file
      let typesFile = `dist/${mod}/index.d.ts`;

      // Check if there's a more specific types file
      const specificTypesPath = path.join(distDir, mod, `${name.toLowerCase()}.d.ts`);
      if (fs.existsSync(specificTypesPath)) {
        typesFile = `dist/${mod}/${name.toLowerCase()}.d.ts`;
      }

      sourceMap.exports[name] = {
        types: typesFile,
        implementation: `dist/${info.chunk}`,
        line,
      };
    }

    sourceMap.modules[mod] = {
      index: `dist/${mod}/index.js`,
      chunks: [...chunks],
    };
  }

  // Also check root index.js for additional exports
  const rootIndexPath = path.join(distDir, 'index.js');
  if (fs.existsSync(rootIndexPath)) {
    const rootExports = parseIndexExports(rootIndexPath);
    for (const [name, info] of rootExports) {
      if (!sourceMap.exports[name]) {
        const chunkPath = path.join(distDir, info.chunk);
        const line = findExportLine(chunkPath, name);

        sourceMap.exports[name] = {
          types: 'dist/index.d.ts',
          implementation: `dist/${info.chunk}`,
          line,
        };
      }
    }
  }

  return sourceMap;
}

// ============================================================================
// MDX to Markdown Transformer
// ============================================================================

function transformMdxToMarkdown(content: string): string {
  let result = content;

  // Step 1: Protect code blocks by replacing them with placeholders
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, match => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Remove import statements (only outside code blocks now)
  result = result.replace(/^import\s+.*?(?:from\s+['"].*?['"])?;?\s*$/gm, '');

  // Remove export statements (only outside code blocks now)
  result = result.replace(/^export\s+.*?(?:from\s+['"].*?['"])?;?\s*$/gm, '');

  // Remove MDX component tags but keep their content
  // Handle <Steps> and </Steps>
  result = result.replace(/<\/?Steps>/g, '');

  // Handle <StepItem> - convert to numbered list style
  result = result.replace(/<StepItem>/g, '### Step');
  result = result.replace(/<\/StepItem>/g, '');

  // Handle <Tabs> and <TabItem>
  result = result.replace(/<Tabs>/g, '');
  result = result.replace(/<\/Tabs>/g, '');
  result = result.replace(/<TabItem\s+value="([^"]+)"[^>]*>/g, '**$1:**\n');
  result = result.replace(/<\/TabItem>/g, '');

  // Handle <PropertiesTable> - strip entirely (including complex nested JSX content)
  // These components have multi-line JSX with nested objects/arrays
  // Match from <PropertiesTable to /> (self-closing) - greedy to handle nested braces
  result = result.replace(/<PropertiesTable\s[\s\S]*?\/>/g, '');
  // Match paired tags
  result = result.replace(/<PropertiesTable>[\s\S]*?<\/PropertiesTable>/g, '');

  // Handle <CardGridItem> - navigation cards, strip them
  result = result.replace(/<CardGridItem[^>]*>[\s\S]*?<\/CardGridItem>/g, '');
  result = result.replace(/<\/?CardGrid>/g, '');

  // Handle <ProviderModelsTable> - strip dynamic tables
  result = result.replace(/<ProviderModelsTable[^>]*\/>/g, '');

  // Handle Docusaurus admonitions (:::tip, :::note, etc.)
  result = result.replace(/:::(tip|note|warning|caution|info)\[([^\]]*)\]/g, '> **$2**');
  result = result.replace(/:::(tip|note|warning|caution|info)/g, '> **Note:**');
  result = result.replace(/:::/g, '');

  // Remove HTML comments (loop to handle nested/malformed cases)
  let previousResult;
  do {
    previousResult = result;
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  } while (result !== previousResult && result.includes('<!--'));

  // Remove simple JSX expressions like {props.something} but NOT inside code blocks
  // Only match JSX expressions that look like {identifier.property} patterns
  result = result.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+\}/g, '');

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Step 2: Restore code blocks
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[parseInt(index, 10)]);

  // Trim whitespace
  result = result.trim();

  return result;
}

function extractFrontmatter(content: string): { title?: string; description?: string; content: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { content };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/);
  const descriptionMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/);

  return {
    title: titleMatch?.[1]?.split('|')[0]?.trim(),
    description: descriptionMatch?.[1],
    content: body,
  };
}

// ============================================================================
// SKILL.md Generator
// ============================================================================

function generateSkillMd(sourceMap: SourceMap, config: DocsConfig, topics: DocTopic[]): string {
  const packageName = sourceMap.package;
  const skillName = config.skillName || packageName.replace('@', '').replace('/', '-') + '-docs';
  const skillDescription =
    config.skillDescription ||
    `Documentation for ${packageName}. Includes links to type definitions and readable implementation code in dist/.`;

  const topExports = Object.entries(sourceMap.exports)
    .slice(0, 20)
    .map(([name, info]) => `  - ${name}: ${info.types}`)
    .join('\n');

  const topicLinks = topics
    .map(
      t =>
        `- [${t.title}](${t.id}/01-${t.sourceFiles[0]?.split('/').pop()?.replace('.mdx', '.md') || 'overview.md'}) - ${t.title}`,
    )
    .join('\n');

  return `---
name: ${skillName}
description: ${skillDescription}
---

# ${packageName} Documentation

> **Version**: ${sourceMap.version}
> **Package**: ${sourceMap.package}

## Quick Navigation

Use SOURCE_MAP.json to find any export:

\`\`\`bash
cat docs/SOURCE_MAP.json
\`\`\`

Each export maps to:
- **types**: \`.d.ts\` file with JSDoc and API signatures
- **implementation**: \`.js\` chunk file with readable source
- **docs**: Conceptual documentation in \`docs/\`

## Finding Documentation

### For a specific export

\`\`\`bash
# Read the source map
cat docs/SOURCE_MAP.json | grep -A 5 '"ExportName"'
\`\`\`

### For a topic

\`\`\`bash
# List topics
ls docs/

# Read a topic
cat docs/<topic>/01-overview.md
\`\`\`

## Code References Are Unminified

Mastra's compiled \`.js\` files in \`dist/\` are:
- Unminified with readable code
- Preserve JSDoc comments and examples
- Include implementation details

## Top Exports

${topExports}

See SOURCE_MAP.json for the complete list.

## Available Topics

${topicLinks}

## Using Type Definitions

Type files (\`.d.ts\`) include full JSDoc documentation:

\`\`\`bash
cat dist/<module>/<name>.d.ts
\`\`\`

## Using Implementation Files

Implementation files show actual logic:

\`\`\`bash
# Find where exports come from
cat dist/<module>/index.js

# Read the chunk (unminified, readable!)
cat dist/chunk-*.js
\`\`\`
`;
}

// ============================================================================
// README.md Generator
// ============================================================================

function generateReadme(sourceMap: SourceMap, topics: DocTopic[]): string {
  const topicList = topics.map(t => `├── ${t.id}/`).join('\n');

  return `# ${sourceMap.package} Documentation

> Embedded documentation for coding agents

## Quick Start

\`\`\`bash
# Read the skill overview (for Claude Skills)
cat docs/SKILL.md

# Get the source map (machine-readable)
cat docs/SOURCE_MAP.json

# Read topic documentation
cat docs/<topic>/01-overview.md
\`\`\`

## Structure

\`\`\`
docs/
├── SKILL.md           # Claude Skills entry point
├── README.md          # This file
├── SOURCE_MAP.json    # Machine-readable export index
${topicList}
\`\`\`

## Finding Code

The SOURCE_MAP.json maps every export to its:
- **types**: \`.d.ts\` file with API signatures and JSDoc
- **implementation**: \`.js\` chunk file with readable source code
- **line**: Line number in the chunk file

## Key Insight

Unlike most npm packages, Mastra's compiled JavaScript is **unminified** and fully readable.
You can read the actual implementation directly.

## Version

Package: ${sourceMap.package}
Version: ${sourceMap.version}
`;
}

// ============================================================================
// Doc Generator
// ============================================================================

function processDocTopic(topic: DocTopic, sourceMap: SourceMap, config: DocsConfig, docsOutputDir: string): void {
  const outputDir = path.join(docsOutputDir, topic.id);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let fileIndex = 1;

  for (const sourceFile of topic.sourceFiles) {
    const sourcePath = path.join(MDX_DOCS_DIR, sourceFile);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`  Warning: Source file not found: ${sourceFile}`);
      continue;
    }

    const content = fs.readFileSync(sourcePath, 'utf-8');
    const { title, description, content: body } = extractFrontmatter(content);

    // Transform MDX to Markdown
    let markdown = transformMdxToMarkdown(body);

    // Add header with code references if this is an overview file
    // Auto-discovers from imports/code in the MDX, or uses explicit codeReferences from config
    if (sourceFile.includes('overview')) {
      const codeRefs = getTopicCodeReferences(topic, sourceMap, content);

      if (codeRefs.length > 0) {
        const codeLinks = codeRefs
          .slice(0, 5)
          .map(
            ([name, info]) =>
              `- \`${name}\`: ${info.types}${info.line ? ` → ${info.implementation}:${info.line}` : ''}`,
          )
          .join('\n');

        markdown = `> **Code References:**\n${codeLinks}\n\n${markdown}`;
      }
    }

    // Add title if extracted and not already present
    if (title && !markdown.match(/^#\s/m)) {
      markdown = `# ${title}\n\n${description ? `> ${description}\n\n` : ''}${markdown}`;
    } else if (description && !markdown.includes(description)) {
      markdown = `> ${description}\n\n${markdown}`;
    }

    // Generate output filename
    const baseName = path.basename(sourceFile, '.mdx');
    const outputName = `${String(fileIndex).padStart(2, '0')}-${baseName}.md`;
    const outputPath = path.join(outputDir, outputName);

    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.info(`  Generated: ${topic.id}/${outputName}`);

    fileIndex++;
  }
}

// ============================================================================
// Main
// ============================================================================

async function generateDocsForPackage(packagePath: string): Promise<void> {
  const packageRoot = path.resolve(MONOREPO_ROOT, packagePath);
  const configPath = path.join(packageRoot, 'docs.config.json');

  if (!fs.existsSync(configPath)) {
    console.warn(`No docs.config.json found in ${packagePath}, skipping...`);
    return;
  }

  const config: DocsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));
  const docsOutputDir = path.join(packageRoot, 'docs');

  console.info(`\n📚 Generating documentation for ${packageJson.name}\n`);

  // Create docs directory
  if (!fs.existsSync(docsOutputDir)) {
    fs.mkdirSync(docsOutputDir, { recursive: true });
  }

  // Step 1: Generate SOURCE_MAP.json
  console.info('1. Generating SOURCE_MAP.json...');
  const sourceMap = generateSourceMap(packageRoot, config);
  const sourceMapPath = path.join(docsOutputDir, 'SOURCE_MAP.json');
  fs.writeFileSync(sourceMapPath, JSON.stringify(sourceMap, null, 2), 'utf-8');
  console.info(
    `   Found ${Object.keys(sourceMap.exports).length} exports across ${Object.keys(sourceMap.modules).length} modules\n`,
  );

  // Step 2: Generate SKILL.md
  console.info('2. Generating SKILL.md...');
  const skillMd = generateSkillMd(sourceMap, config, config.topics);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');
  console.info('   Generated SKILL.md with Anthropic-compatible YAML frontmatter\n');

  // Step 3: Generate README.md
  console.info('3. Generating README.md...');
  const readme = generateReadme(sourceMap, config.topics);
  fs.writeFileSync(path.join(docsOutputDir, 'README.md'), readme, 'utf-8');
  console.info('   Generated README.md\n');

  // Step 4: Process doc topics
  console.info('4. Processing documentation topics...');
  for (const topic of config.topics) {
    console.info(`\n   Processing ${topic.title}...`);
    processDocTopic(topic, sourceMap, config, docsOutputDir);
  }

  console.info(`\n✅ Documentation generation complete for ${packageJson.name}!`);
  console.info(`   Output directory: ${docsOutputDir}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Generate for specific package(s)
    for (const packagePath of args) {
      await generateDocsForPackage(packagePath);
    }
  } else {
    // Discover all packages with docs.config.json in known directories
    console.info('🔍 Discovering packages with docs.config.json...\n');

    const packageDirs = ['packages', 'stores', 'voice', 'observability', 'deployers', 'client-sdks', 'auth'];

    const configs: string[] = [];

    for (const dir of packageDirs) {
      const dirPath = path.join(MONOREPO_ROOT, dir);
      if (!fs.existsSync(dirPath)) continue;

      const subdirs = fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const subdir of subdirs) {
        const configPath = path.join(dir, subdir, 'docs.config.json');
        const fullConfigPath = path.join(MONOREPO_ROOT, configPath);
        if (fs.existsSync(fullConfigPath)) {
          configs.push(path.join(dir, subdir));
        }
      }
    }

    if (configs.length === 0) {
      console.info('No packages with docs.config.json found.');
      return;
    }

    console.info(`Found ${configs.length} package(s) with documentation config:\n`);
    for (const packagePath of configs) {
      console.info(`  - ${packagePath}`);
    }

    for (const packagePath of configs) {
      await generateDocsForPackage(packagePath);
    }
  }
}

// Run if executed directly
main().catch(error => {
  console.error('Failed to generate package docs:', error);
  process.exit(1);
});
