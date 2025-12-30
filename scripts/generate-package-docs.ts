#!/usr/bin/env npx tsx
/**
 * Shared script for generating embedded documentation for Mastra packages.
 *
 * Uses frontmatter `packages` field in MDX files to determine which docs belong to which package.
 *
 * Usage:
 *   pnpm generate:docs                     # Generate for all packages
 *   pnpm generate:docs @mastra/core        # Generate for a specific package
 *   pnpm generate:docs packages/core       # Generate for a specific package by path
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.join(__dirname, '..');
const MDX_DOCS_DIR = path.join(MONOREPO_ROOT, 'docs/src/content/en');

// Cache for sidebar order
const sidebarOrderCache = new Map<string, Map<string, number>>();

// Scan the entire docs folder - frontmatter determines what gets included

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

interface MdxFile {
  path: string;
  relativePath: string;
  packages: string[];
  title?: string;
  description?: string;
  content: string;
  isReference: boolean;
}

interface DocTopic {
  id: string;
  title: string;
  files: MdxFile[];
}

// ============================================================================
// Sidebar Order Parser
// ============================================================================

function parseSidebarOrder(sidebarPath: string): Map<string, number> {
  const orderMap = new Map<string, number>();

  if (!fs.existsSync(sidebarPath)) {
    return orderMap;
  }

  const content = fs.readFileSync(sidebarPath, 'utf-8');

  // Extract doc IDs in order using regex
  // Matches: id: "agents/overview" or id: 'agents/overview'
  const idRegex = /id:\s*["']([^"']+)["']/g;
  let match;
  let order = 0;

  while ((match = idRegex.exec(content)) !== null) {
    const docId = match[1];
    orderMap.set(docId, order++);
  }

  return orderMap;
}

function getSidebarOrder(category: string): Map<string, number> {
  // Check cache first
  if (sidebarOrderCache.has(category)) {
    return sidebarOrderCache.get(category)!;
  }

  // Determine which sidebar file to use based on category
  let sidebarPath: string;

  if (category === 'reference' || category.startsWith('reference/')) {
    sidebarPath = path.join(MDX_DOCS_DIR, 'reference/sidebars.js');
  } else if (category === 'guides' || category.startsWith('guides/')) {
    sidebarPath = path.join(MDX_DOCS_DIR, 'guides/sidebars.js');
  } else if (category === 'models' || category.startsWith('models/')) {
    sidebarPath = path.join(MDX_DOCS_DIR, 'models/sidebars.js');
  } else {
    // Default to docs sidebar
    sidebarPath = path.join(MDX_DOCS_DIR, 'docs/sidebars.js');
  }

  const orderMap = parseSidebarOrder(sidebarPath);
  sidebarOrderCache.set(category, orderMap);

  return orderMap;
}

function getFileOrder(file: MdxFile, orderMap: Map<string, number>): number {
  // Extract the doc ID from the relative path
  // e.g., "docs/agents/overview.mdx" -> "agents/overview"
  const parts = file.relativePath.split('/');
  let docId: string;

  if (parts[0] === 'docs' || parts[0] === 'reference' || parts[0] === 'guides') {
    // Remove the first part (docs/reference/guides) and .mdx extension
    docId = parts.slice(1).join('/').replace(/\.mdx$/, '');
  } else {
    docId = file.relativePath.replace(/\.mdx$/, '');
  }

  // Check if we have an order for this doc
  const order = orderMap.get(docId);
  if (order !== undefined) {
    return order;
  }

  // Fallback: overview/index first, then alphabetical (high number)
  const baseName = path.basename(file.relativePath);
  if (baseName.includes('overview') || baseName.includes('index')) {
    return -1;
  }

  return 9999; // Put at end if not in sidebar
}

// ============================================================================
// MDX File Scanner
// ============================================================================

function extractFrontmatter(content: string): {
  packages: string[];
  title?: string;
  description?: string;
  content: string;
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { packages: [], content };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Extract packages array
  const packagesMatch = frontmatter.match(/packages:\n((?:\s+-\s+"[^"]+"\n?)+)/);
  const packages: string[] = [];
  if (packagesMatch) {
    const pkgLines = packagesMatch[1].match(/-\s+"([^"]+)"/g) || [];
    for (const line of pkgLines) {
      const match = line.match(/-\s+"([^"]+)"/);
      if (match) packages.push(match[1]);
    }
  }

  const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/);
  const descriptionMatch = frontmatter.match(/description:\s*["']?([^"'\n]+)["']?/);

  return {
    packages,
    title: titleMatch?.[1]?.split('|')[0]?.trim(),
    description: descriptionMatch?.[1],
    content: body,
  };
}

function findMdxFiles(): MdxFile[] {
  const files: MdxFile[] = [];

  const walkDir = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(entryPath);
      } else if (entry.name.endsWith('.mdx')) {
        const content = fs.readFileSync(entryPath, 'utf-8');
        const { packages, title, description, content: body } = extractFrontmatter(content);

        if (packages.length > 0) {
          const relativePath = path.relative(MDX_DOCS_DIR, entryPath);
          files.push({
            path: entryPath,
            relativePath,
            packages,
            title,
            description,
            content: body,
            isReference: relativePath.startsWith('reference/'),
          });
        }
      }
    }
  };

  walkDir(MDX_DOCS_DIR);
  return files;
}

function getFilesForPackage(allFiles: MdxFile[], packageName: string): MdxFile[] {
  return allFiles.filter(f => f.packages.includes(packageName));
}

function groupFilesIntoTopics(files: MdxFile[]): DocTopic[] {
  const topicMap = new Map<string, MdxFile[]>();

  for (const file of files) {
    // Determine topic from file path
    // e.g., "reference/agents/generate.mdx" -> "agents"
    // e.g., "docs/memory/overview.mdx" -> "memory"
    const parts = file.relativePath.split('/');
    let topicId: string;

    if (parts[0] === 'reference') {
      topicId = parts[1] || 'reference';
    } else if (parts[0] === 'docs') {
      topicId = parts[1] || 'docs';
    } else {
      topicId = parts[0];
    }

    if (!topicMap.has(topicId)) {
      topicMap.set(topicId, []);
    }
    topicMap.get(topicId)!.push(file);
  }

  // Convert to DocTopic array
  const topics: DocTopic[] = [];
  for (const [id, topicFiles] of topicMap) {
    // Get sidebar order for this topic
    const firstFile = topicFiles[0];
    const category = firstFile?.relativePath.split('/')[0] || 'docs';
    const orderMap = getSidebarOrder(category);

    // Sort files: use sidebar order if available, else overview first, then alphabetically
    topicFiles.sort((a, b) => {
      const aOrder = getFileOrder(a, orderMap);
      const bOrder = getFileOrder(b, orderMap);

      // If both have sidebar order, use that
      if (aOrder !== 9999 || bOrder !== 9999) {
        return aOrder - bOrder;
      }

      // Fallback to alphabetical
      const aName = path.basename(a.relativePath);
      const bName = path.basename(b.relativePath);
      return aName.localeCompare(bName);
    });

    topics.push({
      id,
      title: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      files: topicFiles,
    });
  }

  // Sort topics alphabetically
  topics.sort((a, b) => a.id.localeCompare(b.id));

  return topics;
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

function generateSourceMap(packageRoot: string): SourceMap {
  const distDir = path.join(packageRoot, 'dist');
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));

  const sourceMap: SourceMap = {
    version: packageJson.version,
    package: packageJson.name,
    exports: {},
    modules: {},
  };

  // Default modules to analyze
  const modules = [
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

  // Remove 'copy' attribute from code fences (MDX-specific) - do this before protection
  result = result.replace(/```(\w+)\s+copy/g, '```$1');

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
  result = result.replace(/<\/?Steps>/g, '');
  result = result.replace(/<StepItem>/g, '### Step');
  result = result.replace(/<\/StepItem>/g, '');
  result = result.replace(/<Tabs>/g, '');
  result = result.replace(/<\/Tabs>/g, '');
  result = result.replace(/<TabItem\s+value="([^"]+)"[^>]*>/g, '**$1:**\n');
  result = result.replace(/<\/TabItem>/g, '');

  // Handle <PropertiesTable> - strip entirely
  result = result.replace(/<PropertiesTable\s[\s\S]*?\/>/g, '');
  result = result.replace(/<PropertiesTable>[\s\S]*?<\/PropertiesTable>/g, '');

  // Handle <CardGridItem> - strip navigation cards
  result = result.replace(/<CardGridItem[^>]*>[\s\S]*?<\/CardGridItem>/g, '');
  result = result.replace(/<\/?CardGrid>/g, '');

  // Handle <ProviderModelsTable>
  result = result.replace(/<ProviderModelsTable[^>]*\/>/g, '');

  // Handle Docusaurus admonitions
  result = result.replace(/:::(tip|note|warning|caution|info)\[([^\]]*)\]/g, '> **$2**');
  result = result.replace(/:::(tip|note|warning|caution|info)/g, '> **Note:**');
  result = result.replace(/:::/g, '');

  // Remove HTML comments
  let previousResult;
  do {
    previousResult = result;
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  } while (result !== previousResult && result.includes('<!--'));

  // Remove JSX expressions like {props.something}
  result = result.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+\}/g, '');

  // Convert relative doc links to full URLs
  // Matches: [text](/docs/...) or [text](/reference/...) or [text](/guides/...)
  result = result.replace(
    /\]\(\/((docs|reference|guides|examples|models)\/[^)]+)\)/g,
    '](https://mastra.ai/$1)',
  );

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Step 2: Restore code blocks
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => codeBlocks[parseInt(index, 10)]);

  return result.trim();
}

// ============================================================================
// Code Reference Extraction
// ============================================================================

function extractCodeReferencesFromContent(content: string, sourceMap: SourceMap): string[] {
  const discovered = new Set<string>();
  const exportNames = Object.keys(sourceMap.exports);

  // 1. Parse import statements
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

  // 2. Find inline code references
  const inlineCodeRegex = /`([A-Z][a-zA-Z]*)`/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    const name = match[1];
    if (exportNames.includes(name)) {
      discovered.add(name);
    }
  }

  // 3. Find function calls
  const functionCallRegex = /(?:new\s+)?([A-Z][a-zA-Z]*)\s*\(/g;
  while ((match = functionCallRegex.exec(content)) !== null) {
    const name = match[1];
    if (exportNames.includes(name)) {
      discovered.add(name);
    }
  }

  return [...discovered];
}

// ============================================================================
// Generators
// ============================================================================

function generateSkillMd(sourceMap: SourceMap, topics: DocTopic[]): string {
  const packageName = sourceMap.package;
  const skillName = packageName.replace('@', '').replace('/', '-') + '-docs';
  const skillDescription = `Documentation for ${packageName}. Includes links to type definitions and readable implementation code in dist/.`;

  const topExports = Object.entries(sourceMap.exports)
    .slice(0, 20)
    .map(([name, info]) => `  - ${name}: ${info.types}`)
    .join('\n');

  const topicLinks = topics.map(t => `- [${t.title}](${t.id}/) - ${t.files.length} file(s)`).join('\n');

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

## Top Exports

${topExports}

See SOURCE_MAP.json for the complete list.

## Available Topics

${topicLinks}
`;
}

function generateReadme(sourceMap: SourceMap, topics: DocTopic[]): string {
  const topicList = topics.map(t => `├── ${t.id}/ (${t.files.length} files)`).join('\n');

  return `# ${sourceMap.package} Documentation

> Embedded documentation for coding agents

## Quick Start

\`\`\`bash
# Read the skill overview
cat docs/SKILL.md

# Get the source map
cat docs/SOURCE_MAP.json

# Read topic documentation
cat docs/<topic>/01-overview.md
\`\`\`

## Structure

\`\`\`
docs/
├── SKILL.md           # Entry point
├── README.md          # This file
├── SOURCE_MAP.json    # Export index
${topicList}
\`\`\`

## Version

Package: ${sourceMap.package}
Version: ${sourceMap.version}
`;
}

// ============================================================================
// Doc Generator
// ============================================================================

function processDocTopic(topic: DocTopic, sourceMap: SourceMap, docsOutputDir: string): void {
  const outputDir = path.join(docsOutputDir, topic.id);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Separate conceptual docs from reference docs
  const conceptualFiles = topic.files.filter(f => !f.isReference);
  const referenceFiles = topic.files.filter(f => f.isReference);

  let fileIndex = 1;

  // Process conceptual docs as individual files
  for (const file of conceptualFiles) {
    // Transform MDX to Markdown
    let markdown = transformMdxToMarkdown(file.content);

    // Add code references for overview files
    if (file.relativePath.includes('overview') || file.relativePath.includes('index')) {
      const codeRefs = extractCodeReferencesFromContent(file.content, sourceMap);
      if (codeRefs.length > 0) {
        const codeLinks = codeRefs
          .slice(0, 5)
          .filter(name => sourceMap.exports[name])
          .map(name => {
            const info = sourceMap.exports[name];
            return `- \`${name}\`: ${info.types}${info.line ? ` → ${info.implementation}:${info.line}` : ''}`;
          })
          .join('\n');

        if (codeLinks) {
          markdown = `> **Code References:**\n${codeLinks}\n\n${markdown}`;
        }
      }
    }

    // Add title if not present
    if (file.title && !markdown.match(/^#\s/m)) {
      markdown = `# ${file.title}\n\n${file.description ? `> ${file.description}\n\n` : ''}${markdown}`;
    } else if (file.description && !markdown.includes(file.description)) {
      markdown = `> ${file.description}\n\n${markdown}`;
    }

    // Generate output filename
    const baseName = path.basename(file.relativePath, '.mdx');
    const outputName = `${String(fileIndex).padStart(2, '0')}-${baseName}.md`;
    const outputPath = path.join(outputDir, outputName);

    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.info(`  Generated: ${topic.id}/${outputName}`);

    fileIndex++;
  }

  // Collapse all reference docs into a single file
  if (referenceFiles.length > 0) {
    const referenceMarkdown: string[] = [];
    referenceMarkdown.push(`# ${topic.title} API Reference\n`);
    referenceMarkdown.push(`> API reference for ${topic.title.toLowerCase()} - ${referenceFiles.length} entries\n`);

    for (const file of referenceFiles) {
      let markdown = transformMdxToMarkdown(file.content);

      // Add section header with the method/class name
      const baseName = path.basename(file.relativePath, '.mdx');
      const sectionTitle = file.title || baseName;

      // Use h2 for each reference entry
      referenceMarkdown.push(`\n---\n`);
      referenceMarkdown.push(`## ${sectionTitle}\n`);

      if (file.description) {
        referenceMarkdown.push(`> ${file.description}\n`);
      }

      // Remove h1 from the content if present (we already added the title)
      markdown = markdown.replace(/^#\s+[^\n]+\n+/, '');

      referenceMarkdown.push(markdown);
    }

    const outputName = `${String(fileIndex).padStart(2, '0')}-reference.md`;
    const outputPath = path.join(outputDir, outputName);

    fs.writeFileSync(outputPath, referenceMarkdown.join('\n'), 'utf-8');
    console.info(`  Generated: ${topic.id}/${outputName} (${referenceFiles.length} entries)`);
  }
}

// ============================================================================
// Package Resolution
// ============================================================================

function resolvePackagePath(packageArg: string): { packageRoot: string; packageName: string } | null {
  // If it's a path like "packages/core"
  if (packageArg.includes('/') && !packageArg.startsWith('@')) {
    const packageRoot = path.resolve(MONOREPO_ROOT, packageArg);
    const packageJsonPath = path.join(packageRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.error(`Package not found at ${packageArg}`);
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return { packageRoot, packageName: packageJson.name };
  }

  // If it's a package name like "@mastra/core"
  // Search for it in known directories
  const searchDirs = ['packages', 'stores', 'voice', 'observability', 'deployers', 'client-sdks', 'auth'];

  for (const dir of searchDirs) {
    const dirPath = path.join(MONOREPO_ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;

    const subdirs = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const subdir of subdirs) {
      const packageJsonPath = path.join(dirPath, subdir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name === packageArg) {
          return {
            packageRoot: path.join(dirPath, subdir),
            packageName: packageJson.name,
          };
        }
      }
    }
  }

  console.error(`Package ${packageArg} not found in monorepo`);
  return null;
}

function getAllPackagesWithDocs(allFiles: MdxFile[]): Set<string> {
  const packages = new Set<string>();
  for (const file of allFiles) {
    for (const pkg of file.packages) {
      packages.add(pkg);
    }
  }
  return packages;
}

// ============================================================================
// Main
// ============================================================================

async function generateDocsForPackage(packageName: string, packageRoot: string, allFiles: MdxFile[]): Promise<void> {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));
  const docsOutputDir = path.join(packageRoot, 'dist', 'docs');

  // Get files for this package
  const packageFiles = getFilesForPackage(allFiles, packageName);

  if (packageFiles.length === 0) {
    console.warn(`No documentation found for ${packageName}`);
    return;
  }

  console.info(`\n📚 Generating documentation for ${packageName} (${packageFiles.length} files)\n`);

  // Clean and create docs directory
  if (fs.existsSync(docsOutputDir)) {
    fs.rmSync(docsOutputDir, { recursive: true });
  }
  fs.mkdirSync(docsOutputDir, { recursive: true });

  // Step 1: Generate SOURCE_MAP.json
  console.info('1. Generating SOURCE_MAP.json...');
  const sourceMap = generateSourceMap(packageRoot);
  const sourceMapPath = path.join(docsOutputDir, 'SOURCE_MAP.json');
  fs.writeFileSync(sourceMapPath, JSON.stringify(sourceMap, null, 2), 'utf-8');
  console.info(
    `   Found ${Object.keys(sourceMap.exports).length} exports across ${Object.keys(sourceMap.modules).length} modules\n`,
  );

  // Step 2: Group files into topics
  const topics = groupFilesIntoTopics(packageFiles);

  // Step 3: Generate SKILL.md
  console.info('2. Generating SKILL.md...');
  const skillMd = generateSkillMd(sourceMap, topics);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');
  console.info('   Generated SKILL.md\n');

  // Step 4: Generate README.md
  console.info('3. Generating README.md...');
  const readme = generateReadme(sourceMap, topics);
  fs.writeFileSync(path.join(docsOutputDir, 'README.md'), readme, 'utf-8');
  console.info('   Generated README.md\n');

  // Step 5: Process doc topics
  console.info('4. Processing documentation topics...');
  for (const topic of topics) {
    console.info(`\n   Processing ${topic.title} (${topic.files.length} files)...`);
    processDocTopic(topic, sourceMap, docsOutputDir);
  }

  console.info(`\n✅ Documentation generation complete for ${packageName}!`);
  console.info(`   Output directory: ${docsOutputDir}`);
}

async function main(): Promise<void> {
  console.info('🔍 Scanning MDX files for packages frontmatter...\n');

  // Scan all MDX files once
  const allFiles = findMdxFiles();
  console.info(`Found ${allFiles.length} MDX files with packages frontmatter\n`);

  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Generate for specific package(s)
    for (const packageArg of args) {
      const resolved = resolvePackagePath(packageArg);
      if (resolved) {
        await generateDocsForPackage(resolved.packageName, resolved.packageRoot, allFiles);
      }
    }
  } else {
    // Generate for all packages that have docs
    const packagesWithDocs = getAllPackagesWithDocs(allFiles);
    console.info(`Found documentation for ${packagesWithDocs.size} packages:\n`);

    for (const pkg of [...packagesWithDocs].sort()) {
      console.info(`  - ${pkg}`);
    }

    for (const pkg of packagesWithDocs) {
      const resolved = resolvePackagePath(pkg);
      if (resolved) {
        await generateDocsForPackage(resolved.packageName, resolved.packageRoot, allFiles);
      }
    }
  }
}

// Run if executed directly
main().catch(error => {
  console.error('Failed to generate package docs:', error);
  process.exit(1);
});
