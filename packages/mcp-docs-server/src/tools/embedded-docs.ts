import fs from 'node:fs/promises';
import path from 'node:path';
import { getPackageInfo } from 'local-pkg';
import { z } from 'zod';
import { logger } from '../logger';

/**
 * Embedded Docs MCP Tools
 *
 * These tools help coding agents navigate and understand Mastra packages
 * by reading the embedded documentation from node_modules.
 */

// Types for SOURCE_MAP.json
interface ExportInfo {
  types: string;
  implementation: string;
  line?: number;
}

interface SourceMap {
  version: string;
  package: string;
  exports: Record<string, ExportInfo>;
}

// Cache for performance
const packageCache = new Map<string, string[]>();
const sourceMapCache = new Map<string, SourceMap | null>();
const packageInfoCache = new Map<string, { rootPath: string; version: string } | null>();

// List of known @mastra packages to check for
const KNOWN_MASTRA_PACKAGES = [
  '@mastra/core',
  '@mastra/cli',
  '@mastra/memory',
  '@mastra/rag',
  '@mastra/evals',
  '@mastra/mcp',
  '@mastra/server',
  '@mastra/deployer',
  '@mastra/agent-builder',
  '@mastra/auth',
  '@mastra/fastembed',
  '@mastra/loggers',
  '@mastra/schema-compat',
  '@mastra/codemod',
] as const;

// Helper to get package info using local-pkg (works across all package managers)
async function getPackageRootPath(packageName: string): Promise<{ rootPath: string; version: string } | null> {
  if (packageInfoCache.has(packageName)) {
    return packageInfoCache.get(packageName)!;
  }

  try {
    const info = await getPackageInfo(packageName);
    if (info?.rootPath) {
      const result = { rootPath: info.rootPath, version: info.version || 'unknown' };
      packageInfoCache.set(packageName, result);
      void logger.debug('Resolved package with local-pkg', { packageName, ...result });
      return result;
    }
  } catch (err) {
    void logger.debug('Package not found or error resolving', {
      packageName,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  packageInfoCache.set(packageName, null);
  return null;
}

// Helper to get installed @mastra packages with embedded docs
async function getInstalledMastraPackages(projectPath: string): Promise<string[]> {
  const cacheKey = projectPath;

  if (packageCache.has(cacheKey)) {
    void logger.debug('Using cached package list', { count: packageCache.get(cacheKey)!.length });
    return packageCache.get(cacheKey)!;
  }

  void logger.debug('Scanning for @mastra packages using local-pkg', { projectPath });

  const packages: string[] = [];
  const packagesWithoutDocs: string[] = [];

  // Check known packages using local-pkg (works with npm, yarn, pnpm, etc.)
  for (const packageName of KNOWN_MASTRA_PACKAGES) {
    const packageInfo = await getPackageRootPath(packageName);

    if (packageInfo) {
      const docsPath = path.join(packageInfo.rootPath, 'dist', 'docs');
      try {
        const stats = await fs.stat(docsPath);
        if (stats.isDirectory()) {
          packages.push(packageName);
          void logger.debug('Found package with embedded docs', { package: packageName });
        } else {
          packagesWithoutDocs.push(packageName);
        }
      } catch {
        packagesWithoutDocs.push(packageName);
      }
    }
  }

  const result = packages.sort();
  packageCache.set(cacheKey, result);

  void logger.info('Package scan complete', {
    packagesWithDocs: result.length,
    packagesWithoutDocs: packagesWithoutDocs.length,
    packages: result,
  });

  return result;
}

// Helper to read SOURCE_MAP.json using package root from local-pkg
async function readSourceMap(packageName: string): Promise<SourceMap | null> {
  if (sourceMapCache.has(packageName)) return sourceMapCache.get(packageName)!;

  try {
    const packageInfo = await getPackageRootPath(packageName);
    if (!packageInfo) {
      sourceMapCache.set(packageName, null);
      return null;
    }

    const sourceMapPath = path.join(packageInfo.rootPath, 'dist', 'docs', 'SOURCE_MAP.json');
    const content = await fs.readFile(sourceMapPath, 'utf-8');
    const sourceMap = JSON.parse(content) as SourceMap;
    sourceMapCache.set(packageName, sourceMap);
    return sourceMap;
  } catch {
    sourceMapCache.set(packageName, null);
    return null;
  }
}

// ============================================================================
// Tool: getMastraHelp (PRIMARY ENTRY POINT)
// ============================================================================

export const getMastraHelpTool = {
  name: 'getMastraHelp',
  description: `🚀 START HERE - Complete guide to Mastra documentation tools.

    This MCP server provides TWO documentation sources:

    ## 📦 LOCAL PACKAGE DOCS (Recommended for Development)
    SOURCE: Your installed @mastra packages in node_modules
    VERSION: Matches your installed code exactly

    ADVANTAGES:
    - ✅ Version-matched to your code
    - ✅ Complete TypeScript type definitions
    - ✅ Works offline
    - ✅ SOURCE_MAP.json with exact exports

    TOOLS: listMastraPackages, getMastraExports, getMastraExportDetails, readMastraDocs, searchMastraDocs
    USE WHEN: Writing code, implementing features, checking APIs, debugging

    ## 🌐 REMOTE WEBSITE DOCS (For Latest Info & Learning)
    SOURCE: mastra.ai website
    VERSION: Latest published documentation

    ADVANTAGES:
    - ✅ Always up-to-date
    - ✅ Blog posts and announcements
    - ✅ Migration guides
    - ✅ Curated examples

    TOOLS: mastraDocs, mastraBlog, mastraExamples, mastraChanges, mastraMigration
    USE WHEN: Learning concepts, checking latest features, migration help

    ## 🎓 INTERACTIVE COURSE
    TOOLS: startMastraCourse, getMastraCourseStatus, etc.
    USE WHEN: User wants guided learning experience

    ---

    RECOMMENDED WORKFLOW:
    1. For coding: listMastraPackages → getMastraExports → getMastraExportDetails
    2. For learning: mastraDocs
    3. Version mismatch: mastraChanges → mastraMigration

    This tool shows you which packages are installed and provides detailed guidance on using all available documentation tools.`,
  parameters: z.object({
    projectPath: z
      .string()
      .describe('Absolute path to your project root (we will search upward for node_modules with Mastra packages)'),
  }),
  execute: async (args: { projectPath: string }) => {
    void logger.debug('Executing getMastraHelp tool', { projectPath: args.projectPath });

    const packages = await getInstalledMastraPackages(args.projectPath);
    if (packages.length === 0) {
      return `No Mastra packages with embedded documentation found in your project.

To use these tools, install Mastra packages like:
- npm install @mastra/core
- npm install @mastra/memory
- npm install @mastra/rag

Then rebuild/reinstall to generate embedded docs.`;
    }

    return `# Mastra Documentation System - Complete Guide

This MCP server provides **TWO** documentation sources. Choose based on your needs:

---

## 📦 LOCAL PACKAGE DOCS (Your Installed Packages)

Found ${packages.length} installed package(s) with embedded documentation:
${packages.map(pkg => `- ${pkg}`).join('\n')}

**SOURCE**: Your node_modules (matches installed code version)
**USE WHEN**: Writing code, implementing features, debugging, checking APIs

### Available LOCAL Tools:

**1. listMastraPackages** - List installed packages
   Returns: Packages with embedded docs

**2. getMastraExports** - Explore package API surface
   Example: See all exports from @mastra/core (Agent, Tool, Workflow, etc.)
   Returns: List of exports with source file locations

**3. getMastraExportDetails** - Get type definitions & code
   Example: Get full TypeScript types for Agent class
   Returns: Complete type definitions and optionally implementation source

**4. readMastraDocs** - Read comprehensive guides
   Example: Read documentation about agents, tools, workflows, memory
   Returns: Topic-based guides and examples from your installed version

**5. searchMastraDocs** - Search local documentation
   Example: Search for "memory processors" or "semantic recall"
   Returns: Relevant excerpts from your installed docs

### Typical LOCAL Workflow:
1. listMastraPackages → see what's installed
2. getMastraExports → explore package API
3. getMastraExportDetails → get type definitions
4. readMastraDocs → learn concepts
5. searchMastraDocs → find specific info

---

## 🌐 REMOTE WEBSITE DOCS (mastra.ai)

**SOURCE**: https://mastra.ai (latest published documentation)
**USE WHEN**: Learning new concepts, checking latest features, migration guides

### Available REMOTE Tools:

**mastraDocs** - Browse official documentation
   Latest guides, references, and tutorials

**mastraBlog** - Read blog posts and announcements
   News, features, changelogs

**mastraExamples** - Get curated code examples
   Full example applications

**mastraChanges** - View package changelogs
   See what's new in each version

**mastraMigration** - Get migration guides
   Upgrade between versions

⚠️ **Version Note**: Remote docs show latest published version. For API reference matching YOUR code, use LOCAL tools above.

---

## 🎓 INTERACTIVE COURSE

**startMastraCourse**, **getMastraCourseStatus**, **startMastraCourseLesson**, **nextMastraCourseStep**, **clearMastraCourseHistory**

Guided learning experience with hands-on exercises.

---

## Quick Start Recommendations

**If you're writing code**: Use LOCAL tools
   → Start with listMastraPackages

**If you're learning**: Use REMOTE tools
   → Start with mastraDocs

**If version differs**: Check changes
   → mastraChanges → mastraMigration`;
  },
};

// ============================================================================
// Tool: listMastraPackages
// ============================================================================

export const listInstalledPackagesTool = {
  name: 'listMastraPackages',
  description: `[📦 LOCAL PACKAGES] Discover which Mastra packages are installed and have documentation available.

    Use this when you need to:
    - See what Mastra packages you can work with
    - Start exploring Mastra documentation
    - Check if a specific package is available

    Returns: List of @mastra/* packages (core, memory, rag, etc.) with embedded docs.
    Next step: Use getMastraExports to explore a specific package's API.`,
  parameters: z.object({
    projectPath: z
      .string()
      .describe('Absolute path to your project root (we will search upward for node_modules with Mastra packages)'),
  }),
  execute: async (args: { projectPath: string }) => {
    void logger.debug('Executing listInstalledMastraPackages tool', {
      projectPath: args.projectPath,
      cwd: process.cwd(),
      env: {
        PWD: process.env.PWD,
        HOME: process.env.HOME,
      },
    });

    const packages = await getInstalledMastraPackages(args.projectPath);
    if (packages.length === 0) {
      return `No @mastra/* packages with embedded docs found in your project.

Install Mastra packages to get started:
- npm install @mastra/core
- npm install @mastra/memory
- npm install @mastra/rag`;
    }

    return [
      `# Installed Mastra Packages`,
      '',
      `Found ${packages.length} package(s) with embedded documentation:`,
      '',
      ...packages.map(pkg => `- ${pkg}`),
      '',
      '## Next Steps',
      '',
      '1. Use **getMastraExports** with a package name to see all available APIs',
      '2. Use **readMastraDocs** with a package name to browse topic guides',
      '3. Use **searchMastraDocs** to find specific information',
    ].join('\n');
  },
};

// ============================================================================
// Tool: getMastraExports
// ============================================================================

export const readSourceMapTool = {
  name: 'getMastraExports',
  description: `[📦 LOCAL PACKAGES] Explore the complete API surface of a Mastra package - see all classes, functions, types, and constants.

    Use this when you need to:
    - Discover what APIs a Mastra package provides (Agent, Tool, Workflow, etc.)
    - See all available classes and functions before implementing
    - Find the right export for your use case
    - Understand package structure and organization

    Returns: List of all exports with their source file locations.
    Next step: Use getMastraExportDetails to get full type definitions and code for a specific export.`,
  parameters: z.object({
    package: z.string().describe('Package name to explore (e.g., "@mastra/core", "@mastra/memory", "@mastra/rag")'),
    projectPath: z.string().describe('Absolute path to your project root (we will search upward for node_modules)'),
    filter: z
      .string()
      .optional()
      .describe('Optional: filter exports by name (case-insensitive, e.g., "Agent", "create", "Tool")'),
  }),
  execute: async (args: { package: string; projectPath: string; filter?: string }) => {
    void logger.debug('Executing readMastraSourceMap tool', { args });

    const sourceMap = await readSourceMap(args.package);
    if (!sourceMap) return `No SOURCE_MAP.json found for ${args.package}.`;

    let exports = Object.entries(sourceMap.exports);
    if (args.filter) {
      const filterLower = args.filter.toLowerCase();
      exports = exports.filter(([name]) => name.toLowerCase().includes(filterLower));
    }

    if (exports.length === 0) {
      return args.filter
        ? `No exports matching "${args.filter}" in ${args.package}.

Try running without a filter to see all available exports.`
        : `No exports found in ${args.package}.`;
    }

    return [
      `# ${sourceMap.package} v${sourceMap.version} - API Exports`,
      '',
      `Found ${exports.length} export(s)${args.filter ? ` matching "${args.filter}"` : ''}:`,
      '',
      ...exports.map(([name, info]) => {
        const line = info.line ? `:${info.line}` : '';
        return `- **${name}**: \`${info.implementation}${line}\``;
      }),
      '',
      '## Next Steps',
      '',
      '- Use **getMastraExportDetails** with an export name to see full type definitions and code',
      '- Use **readMastraDocs** to read conceptual guides and examples',
      '- Use **searchMastraDocs** to find specific topics or patterns',
    ].join('\n');
  },
};

// ============================================================================
// Tool: getMastraExportDetails
// ============================================================================

export const findExportTool = {
  name: 'getMastraExportDetails',
  description: `[📦 LOCAL PACKAGES] Get complete API reference for a specific Mastra export - type definitions, interfaces, and optionally source code.

    Use this when you need to:
    - Understand how to use a specific Mastra class or function (Agent, Tool, Workflow, etc.)
    - See TypeScript type definitions and interfaces
    - Look up method signatures and parameters
    - Read implementation code and examples
    - Understand constructor options and configuration

    Returns: Full TypeScript type definitions and optionally implementation source code.
    Example: Get details on the Agent class to see how to create and configure agents.`,
  parameters: z.object({
    package: z.string().describe('Package name (e.g., "@mastra/core", "@mastra/memory")'),
    exportName: z.string().describe('Exact export name to look up (e.g., "Agent", "createTool", "Workflow")'),
    includeTypes: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include TypeScript type definitions (recommended: true)'),
    includeImplementation: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include source code implementation (useful for understanding internals)'),
    implementationLines: z
      .number()
      .optional()
      .default(50)
      .describe('Number of lines of implementation code to show (default: 50)'),
    projectPath: z.string().describe('Absolute path to your project root (we will search upward for node_modules)'),
  }),
  execute: async (args: {
    package: string;
    exportName: string;
    projectPath: string;
    includeTypes?: boolean;
    includeImplementation?: boolean;
    implementationLines?: number;
  }) => {
    void logger.debug('Executing findMastraExport tool', { args });

    const sourceMap = await readSourceMap(args.package);
    if (!sourceMap) return `No SOURCE_MAP.json found for ${args.package}.`;

    const exportInfo = sourceMap.exports[args.exportName];
    if (!exportInfo) {
      const match = Object.entries(sourceMap.exports).find(
        ([name]) => name.toLowerCase() === args.exportName.toLowerCase(),
      );
      if (match) {
        return `Export "${args.exportName}" not found. Did you mean "${match[0]}"?

Run getMastraExports with package="${args.package}" to see all available exports.`;
      }
      return `Export "${args.exportName}" not found in ${args.package}.

Run getMastraExports with package="${args.package}" to see all available exports.`;
    }

    const packageInfo = await getPackageRootPath(args.package);
    if (!packageInfo) {
      return `Package ${args.package} not found. Make sure it's installed.`;
    }

    const output: string[] = [`# ${args.exportName} (${args.package})`, ''];

    if (args.includeTypes !== false) {
      try {
        const typesPath = path.join(packageInfo.rootPath, exportInfo.types);
        const typesContent = await fs.readFile(typesPath, 'utf-8');
        output.push('## Type Definition', '', `\`${exportInfo.types}\``, '', '```typescript');

        const lines = typesContent.split('\n');
        // Use string search instead of regex to avoid ReDoS vulnerability
        let startLine = lines.findIndex(line => line.includes(args.exportName));

        if (startLine === -1) {
          output.push(typesContent.slice(0, 2000));
        } else {
          startLine = Math.max(0, startLine - 2);
          let endLine = Math.min(lines.length, startLine + 50);
          output.push(lines.slice(startLine, endLine).join('\n'));
        }
        output.push('```', '');
      } catch {
        output.push('## Type Definition', '', `Could not read: ${exportInfo.types}`, '');
      }
    }

    if (args.includeImplementation) {
      try {
        const implPath = path.join(packageInfo.rootPath, exportInfo.implementation);
        const implContent = await fs.readFile(implPath, 'utf-8');
        const lines = implContent.split('\n');
        const numLines = args.implementationLines || 50;

        output.push('## Implementation', '');
        output.push(`\`${exportInfo.implementation}\`${exportInfo.line ? ` (line ${exportInfo.line})` : ''}`);
        output.push('', '```javascript');

        const startLine = exportInfo.line ? Math.max(0, exportInfo.line - 1) : 0;
        const endLine = Math.min(lines.length, startLine + numLines);
        output.push(lines.slice(startLine, endLine).join('\n'));
        if (endLine < lines.length) output.push(`// ... ${lines.length - endLine} more lines`);

        output.push('```', '');
      } catch {
        output.push('## Implementation', '', `Could not read: ${exportInfo.implementation}`, '');
      }
    }

    output.push(
      '## Next Steps',
      '',
      '- Use **readMastraDocs** to see practical guides and examples',
      '- Use **searchMastraDocs** to find usage patterns and best practices',
      '- Use **getMastraExports** to explore related APIs',
    );

    return output.join('\n');
  },
};

// ============================================================================
// Tool: readMastraDocs
// ============================================================================

export const readEmbeddedDocsTool = {
  name: 'readMastraDocs',
  description: `[📦 LOCAL PACKAGES] Read comprehensive guides and documentation on Mastra concepts, patterns, and implementation examples.

    Use this when you need to:
    - Learn how to implement Mastra features (agents, tools, workflows, memory, RAG, etc.)
    - Understand Mastra architecture and design patterns
    - See practical code examples and tutorials
    - Read getting started guides and best practices
    - Understand how different components work together

    Returns: Topic-based documentation with explanations, examples, and usage patterns.
    Available topics: agents, tools, workflows, memory, rag, integrations, deployment, and more.`,
  parameters: z.object({
    package: z.string().describe('Package name to read docs from (e.g., "@mastra/core", "@mastra/memory")'),
    topic: z
      .string()
      .optional()
      .describe(
        'Optional: topic folder to read (e.g., "agents", "tools", "workflows"). Omit to list all available topics.',
      ),
    file: z
      .string()
      .optional()
      .describe('Optional: specific documentation file within the topic (e.g., "01-overview.md")'),
    projectPath: z.string().describe('Absolute path to your project root (we will search upward for node_modules)'),
  }),
  execute: async (args: { package: string; projectPath: string; topic?: string; file?: string }) => {
    void logger.debug('Executing readMastraEmbeddedDocs tool', { args });

    const packageInfo = await getPackageRootPath(args.package);
    if (!packageInfo) {
      return `Package ${args.package} not found. Make sure it's installed.`;
    }

    const docsPath = path.join(packageInfo.rootPath, 'dist', 'docs');

    try {
      await fs.stat(docsPath);
    } catch {
      return `No embedded docs found for ${args.package}.

Make sure the package is installed and has documentation generated.`;
    }

    // List topics if none specified
    if (!args.topic) {
      const entries = await fs.readdir(docsPath, { withFileTypes: true });
      const topics = entries.filter(e => e.isDirectory()).map(e => e.name);
      const files = entries.filter(e => e.isFile()).map(e => e.name);

      return [
        `# ${args.package} - Available Documentation`,
        '',
        '## Root Files',
        ...files.map(f => `- ${f}`),
        '',
        '## Documentation Topics',
        ...topics.map(t => `- **${t}/** - Run readMastraDocs with topic="${t}" to read`),
        '',
        '## Next Steps',
        '',
        '- Choose a topic and run **readMastraDocs** with the topic parameter',
        '- Use **searchMastraDocs** to search for specific information',
        '- Use **getMastraExports** to see available APIs',
      ].join('\n');
    }

    const topicPath = path.join(docsPath, args.topic);

    // Read specific file
    if (args.file) {
      try {
        const content = await fs.readFile(path.join(topicPath, args.file), 'utf-8');
        return `# ${args.package}/${args.topic}/${args.file}

${content}

## Next Steps

- Use **getMastraExportDetails** to see API references for specific classes/functions mentioned
- Use **searchMastraDocs** to find related topics
- Use **getMastraExports** to explore available APIs`;
      } catch {
        return `File not found: ${args.topic}/${args.file}

Run readMastraDocs with package="${args.package}" and topic="${args.topic}" (without file parameter) to see available files.`;
      }
    }

    // Read all files in topic
    try {
      const entries = await fs.readdir(topicPath, { withFileTypes: true });
      const files = entries.filter(e => e.isFile() && e.name.endsWith('.md')).sort();

      if (files.length === 0) {
        return `No markdown files in ${args.topic}/

Run readMastraDocs with package="${args.package}" (without topic parameter) to see available topics.`;
      }

      const contents: string[] = [`# ${args.package} - ${args.topic}`, ''];
      for (const file of files) {
        const content = await fs.readFile(path.join(topicPath, file.name), 'utf-8');
        contents.push(`## ${file.name}`, '', content, '', '---', '');
      }

      contents.push(
        '',
        '## Next Steps',
        '',
        '- Use **getMastraExportDetails** to see API references for specific classes/functions mentioned above',
        '- Use **searchMastraDocs** to find related information',
        '- Use **getMastraExports** to explore the complete API surface',
      );

      return contents.join('\n');
    } catch {
      return `Topic not found: ${args.topic}

Run readMastraDocs with package="${args.package}" (without topic parameter) to see available topics.`;
    }
  },
};

// ============================================================================
// Tool: searchMastraDocs
// ============================================================================

export const searchEmbeddedDocsTool = {
  name: 'searchMastraDocs',
  description: `[📦 LOCAL PACKAGES] Search across all Mastra documentation to find specific information, patterns, or examples.

    Use this when you need to:
    - Find specific topics or concepts quickly (e.g., "memory processors", "tool composition")
    - Locate examples of specific features or patterns
    - Search for error messages or troubleshooting info
    - Find mentions of specific APIs or configuration options
    - Discover where a feature is documented

    Returns: Relevant documentation excerpts with file paths, ranked by relevance.
    Tip: Use specific terms for better results (e.g., "agent memory" vs "memory").`,
  parameters: z.object({
    query: z
      .string()
      .describe('What to search for (case-insensitive, e.g., "workflow steps", "vector store", "authentication")'),
    package: z
      .string()
      .optional()
      .describe('Optional: limit search to a specific package (e.g., "@mastra/core"). Omit to search all packages.'),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe('Optional: maximum number of results to return (default: 10)'),
    projectPath: z.string().describe('Absolute path to your project root (we will search upward for node_modules)'),
  }),
  execute: async (args: { query: string; projectPath: string; package?: string; maxResults?: number }) => {
    void logger.debug('Executing searchMastraEmbeddedDocs tool', { args });

    const packages = args.package ? [args.package] : await getInstalledMastraPackages(args.projectPath);
    if (packages.length === 0) return 'No Mastra packages found.';

    const queryLower = args.query.toLowerCase();
    const results: Array<{ pkg: string; file: string; excerpt: string; score: number }> = [];

    for (const pkg of packages) {
      const packageInfo = await getPackageRootPath(pkg);
      if (!packageInfo) continue;

      const docsPath = path.join(packageInfo.rootPath, 'dist', 'docs');

      try {
        const findFiles = async (dir: string): Promise<string[]> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          const files: string[] = [];
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) files.push(...(await findFiles(fullPath)));
            else if (entry.name.endsWith('.md')) files.push(fullPath);
          }
          return files;
        };

        for (const file of await findFiles(docsPath)) {
          const content = await fs.readFile(file, 'utf-8');
          if (!content.toLowerCase().includes(queryLower)) continue;

          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
              const start = Math.max(0, i - 1);
              const end = Math.min(lines.length, i + 3);
              const excerpt = lines.slice(start, end).join('\n').slice(0, 300);

              // Count occurrences using string split to avoid ReDoS vulnerability
              const contentLower = content.toLowerCase();
              const occurrences = contentLower.split(queryLower).length - 1;

              results.push({
                pkg,
                file: path.relative(docsPath, file),
                excerpt,
                score: occurrences,
              });
              break;
            }
          }
        }
      } catch {
        // Skip packages with errors
      }
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, args.maxResults || 10);

    if (topResults.length === 0) {
      return `No results found for "${args.query}".

Try:
- Using different search terms
- Searching for broader topics
- Using **listMastraPackages** to see available packages
- Using **readMastraDocs** to browse documentation by topic`;
    }

    return [
      `# Search Results: "${args.query}"`,
      '',
      `Found ${results.length} result(s), showing top ${topResults.length}:`,
      '',
      ...topResults.map((r, i) => `## ${i + 1}. ${r.pkg} - ${r.file}\n\n\`\`\`\n${r.excerpt}\n\`\`\`\n`),
      '',
      '## Next Steps',
      '',
      '- Use **readMastraDocs** with a package and topic to read full documentation',
      '- Use **getMastraExportDetails** to see API details for mentioned classes/functions',
      '- Refine your search with more specific terms if needed',
    ].join('\n');
  },
};

// Export all tools
export const embeddedDocsTools = {
  getMastraHelp: getMastraHelpTool,
  listMastraPackages: listInstalledPackagesTool,
  getMastraExports: readSourceMapTool,
  getMastraExportDetails: findExportTool,
  readMastraDocs: readEmbeddedDocsTool,
  searchMastraDocs: searchEmbeddedDocsTool,
};
