import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface ExportInfo {
  types: string;
  implementation: string;
  line?: number;
  docs?: string;
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
  outputDir: string;
}

// ============================================================================
// Configuration
// ============================================================================

const PACKAGE_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PACKAGE_ROOT, 'dist');
const DOCS_OUTPUT_DIR = path.join(PACKAGE_ROOT, 'docs');
const MONOREPO_ROOT = path.join(PACKAGE_ROOT, '../..');
const MDX_DOCS_DIR = path.join(MONOREPO_ROOT, 'docs/src/content/en');

// Topics to extract for @mastra/core
const DOC_TOPICS: DocTopic[] = [
  {
    id: 'agents',
    title: 'Agents',
    sourceFiles: [
      'docs/agents/overview.mdx',
      'docs/agents/using-tools.mdx',
      'docs/agents/agent-memory.mdx',
      'docs/agents/structured-output.mdx',
      'docs/agents/processors.mdx',
      'docs/agents/guardrails.mdx',
      'docs/agents/networks.mdx',
    ],
    outputDir: 'agents',
  },
  {
    id: 'tools',
    title: 'Tools',
    sourceFiles: ['docs/tools-mcp/overview.mdx', 'docs/tools-mcp/advanced-usage.mdx'],
    outputDir: 'tools',
  },
  {
    id: 'workflows',
    title: 'Workflows',
    sourceFiles: [
      'docs/workflows/overview.mdx',
      'docs/workflows/control-flow.mdx',
      'docs/workflows/suspend-and-resume.mdx',
      'docs/workflows/error-handling.mdx',
    ],
    outputDir: 'workflows',
  },
  {
    id: 'streaming',
    title: 'Streaming',
    sourceFiles: ['docs/streaming/overview.mdx', 'docs/streaming/events.mdx'],
    outputDir: 'streaming',
  },
];

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

function generateSourceMap(): SourceMap {
  // Read package.json for version
  const packageJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf-8'));

  const sourceMap: SourceMap = {
    version: packageJson.version,
    package: packageJson.name,
    exports: {},
    modules: {},
  };

  // Modules to analyze
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
    const indexPath = path.join(DIST_DIR, mod, 'index.js');
    const typesPath = path.join(DIST_DIR, mod, 'index.d.ts');

    if (!fs.existsSync(indexPath)) {
      continue;
    }

    const exports = parseIndexExports(indexPath);
    const chunks = new Set<string>();

    for (const [name, info] of exports) {
      chunks.add(info.chunk);

      const chunkPath = path.join(DIST_DIR, info.chunk);
      const line = findExportLine(chunkPath, name);

      // Determine the types file
      let typesFile = `dist/${mod}/index.d.ts`;

      // Check if there's a more specific types file
      const specificTypesPath = path.join(DIST_DIR, mod, `${name.toLowerCase()}.d.ts`);
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
  const rootIndexPath = path.join(DIST_DIR, 'index.js');
  if (fs.existsSync(rootIndexPath)) {
    const rootExports = parseIndexExports(rootIndexPath);
    for (const [name, info] of rootExports) {
      if (!sourceMap.exports[name]) {
        const chunkPath = path.join(DIST_DIR, info.chunk);
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

  // Remove import statements
  result = result.replace(/^import\s+.*?(?:from\s+['"].*?['"])?;?\s*$/gm, '');

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

  // Clean up extra blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

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

function generateSkillMd(sourceMap: SourceMap): string {
  const topExports = Object.entries(sourceMap.exports)
    .slice(0, 20)
    .map(([name, info]) => `  - ${name}: ${info.types}`)
    .join('\n');

  return `---
name: mastra-core-docs
description: Documentation for @mastra/core - an AI agent framework. Use when working with Mastra agents, tools, workflows, streaming, or when the user asks about Mastra APIs. Includes links to type definitions and readable implementation code in dist/.
---

# Mastra Core Documentation

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

### For a specific export (Agent, createTool, Workflow, etc.)

\`\`\`bash
# Read the source map
cat docs/SOURCE_MAP.json | grep -A 5 '"Agent"'

# This tells you:
# - types: dist/agent/index.d.ts
# - implementation: dist/chunk-*.js with line number
\`\`\`

### For a topic (agents, tools, workflows)

\`\`\`bash
# List topics
ls docs/

# Read a topic
cat docs/agents/01-overview.md
\`\`\`

## Code References Are Unminified

Mastra's compiled \`.js\` files in \`dist/\` are:
- Unminified with readable code
- Preserve JSDoc comments and examples
- Include implementation details

You can read them directly:

\`\`\`bash
# See what a module exports (tells you which chunks)
cat dist/agent/index.js

# Read the implementation
cat dist/chunk-IDD63DWQ.js | grep -A 50 "var Agent = class"
\`\`\`

## Top Exports

${topExports}

See SOURCE_MAP.json for the complete list.

## Available Topics

- [Agents](agents/01-overview.md) - Creating and using AI agents
- [Tools](tools/01-overview.md) - Building custom tools
- [Workflows](workflows/01-overview.md) - Orchestrating complex flows
- [Streaming](streaming/01-overview.md) - Real-time responses

## Using Type Definitions

Type files (\`.d.ts\`) include full JSDoc documentation:

\`\`\`bash
cat dist/agent/agent.d.ts
\`\`\`

## Using Implementation Files

Implementation files show actual logic:

\`\`\`bash
# Find where exports come from
cat dist/agent/index.js

# Read the chunk (unminified, readable!)
cat dist/chunk-IDD63DWQ.js
\`\`\`
`;
}

// ============================================================================
// README.md Generator
// ============================================================================

function generateReadme(sourceMap: SourceMap): string {
  return `# @mastra/core Documentation

> Embedded documentation for coding agents

## Quick Start

\`\`\`bash
# Read the skill overview (for Claude Skills)
cat docs/SKILL.md

# Get the source map (machine-readable)
cat docs/SOURCE_MAP.json

# Read topic documentation
cat docs/agents/01-overview.md
\`\`\`

## Structure

\`\`\`
docs/
├── SKILL.md           # Claude Skills entry point
├── README.md          # This file
├── SOURCE_MAP.json    # Machine-readable export index
├── agents/            # Agent documentation
├── tools/             # Tool documentation
├── workflows/         # Workflow documentation
└── streaming/         # Streaming documentation
\`\`\`

## Finding Code

The SOURCE_MAP.json maps every export to its:
- **types**: \`.d.ts\` file with API signatures and JSDoc
- **implementation**: \`.js\` chunk file with readable source code
- **line**: Line number in the chunk file

Example:
\`\`\`json
{
  "Agent": {
    "types": "dist/agent/index.d.ts",
    "implementation": "dist/chunk-IDD63DWQ.js",
    "line": 15137
  }
}
\`\`\`

## Key Insight

Unlike most npm packages, Mastra's compiled JavaScript is **unminified** and fully readable.
You can read the actual implementation:

\`\`\`bash
cat dist/chunk-IDD63DWQ.js | grep -A 100 "var Agent = class"
\`\`\`

## Version

Package: ${sourceMap.package}
Version: ${sourceMap.version}
`;
}

// ============================================================================
// Doc Generator
// ============================================================================

function processDocTopic(topic: DocTopic, sourceMap: SourceMap): void {
  const outputDir = path.join(DOCS_OUTPUT_DIR, topic.outputDir);

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

    // Add header with code links if this is an overview file
    if (sourceFile.includes('overview')) {
      const topicExports = getTopicExports(topic.id, sourceMap);
      if (topicExports.length > 0) {
        const codeLinks = topicExports
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
      // Just add description if title already exists
      markdown = `> ${description}\n\n${markdown}`;
    }

    // Generate output filename
    const baseName = path.basename(sourceFile, '.mdx');
    const outputName = `${String(fileIndex).padStart(2, '0')}-${baseName}.md`;
    const outputPath = path.join(outputDir, outputName);

    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`  Generated: ${topic.outputDir}/${outputName}`);

    fileIndex++;
  }
}

function getTopicExports(topicId: string, sourceMap: SourceMap): [string, ExportInfo][] {
  const topicToExports: Record<string, string[]> = {
    agents: ['Agent', 'MessageList', 'TripWire'],
    tools: ['Tool', 'createTool', 'isVercelTool'],
    workflows: ['Workflow', 'Run', 'Step', 'createStep', 'createWorkflow'],
    streaming: ['MastraModelOutput', 'ToolStream'],
  };

  const exportNames = topicToExports[topicId] || [];
  return exportNames
    .filter(name => sourceMap.exports[name])
    .map(name => [name, sourceMap.exports[name]] as [string, ExportInfo]);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('📚 Generating package documentation for @mastra/core\n');

  // Create docs directory
  if (!fs.existsSync(DOCS_OUTPUT_DIR)) {
    fs.mkdirSync(DOCS_OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Generate SOURCE_MAP.json
  console.log('1. Generating SOURCE_MAP.json...');
  const sourceMap = generateSourceMap();
  const sourceMapPath = path.join(DOCS_OUTPUT_DIR, 'SOURCE_MAP.json');
  fs.writeFileSync(sourceMapPath, JSON.stringify(sourceMap, null, 2), 'utf-8');
  console.log(
    `   Found ${Object.keys(sourceMap.exports).length} exports across ${Object.keys(sourceMap.modules).length} modules\n`,
  );

  // Step 2: Generate SKILL.md
  console.log('2. Generating SKILL.md...');
  const skillMd = generateSkillMd(sourceMap);
  fs.writeFileSync(path.join(DOCS_OUTPUT_DIR, 'SKILL.md'), skillMd, 'utf-8');
  console.log('   Generated SKILL.md with Anthropic-compatible YAML frontmatter\n');

  // Step 3: Generate README.md
  console.log('3. Generating README.md...');
  const readme = generateReadme(sourceMap);
  fs.writeFileSync(path.join(DOCS_OUTPUT_DIR, 'README.md'), readme, 'utf-8');
  console.log('   Generated README.md\n');

  // Step 4: Process doc topics
  console.log('4. Processing documentation topics...');
  for (const topic of DOC_TOPICS) {
    console.log(`\n   Processing ${topic.title}...`);
    processDocTopic(topic, sourceMap);
  }

  console.log('\n✅ Documentation generation complete!');
  console.log(`\nOutput directory: ${DOCS_OUTPUT_DIR}`);
  console.log('\nGenerated files:');
  console.log('  - SKILL.md (Claude Skills entry point)');
  console.log('  - README.md (Navigation index)');
  console.log('  - SOURCE_MAP.json (Machine-readable code map)');
  console.log('  - agents/*.md');
  console.log('  - tools/*.md');
  console.log('  - workflows/*.md');
  console.log('  - streaming/*.md');
}

// Run if executed directly
main().catch(error => {
  console.error('Failed to generate package docs:', error);
  process.exit(1);
});
