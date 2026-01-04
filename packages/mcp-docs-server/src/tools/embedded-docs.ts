import fs from 'node:fs/promises';
import path from 'node:path';
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
const nodeModulesCache = new Map<string, string | null>();

// Helper to find node_modules directory
async function findNodeModules(startDir: string): Promise<string | null> {
  // Use absolute path as cache key
  const absoluteStartDir = path.resolve(startDir);

  if (nodeModulesCache.has(absoluteStartDir)) {
    const cached = nodeModulesCache.get(absoluteStartDir)!;
    void logger.debug('Using cached node_modules path', { startDir: absoluteStartDir, path: cached });
    return cached;
  }

  void logger.debug('Searching for node_modules', {
    startDir: absoluteStartDir,
    cwd: process.cwd(),
  });

  let currentDir = absoluteStartDir;
  const root = path.parse(currentDir).root;
  const searchedPaths: string[] = [];

  while (currentDir !== root) {
    const nodeModulesPath = path.join(currentDir, 'node_modules');
    searchedPaths.push(nodeModulesPath);

    try {
      const stats = await fs.stat(nodeModulesPath);
      if (stats.isDirectory()) {
        void logger.info('Found node_modules directory', { path: nodeModulesPath });
        nodeModulesCache.set(absoluteStartDir, nodeModulesPath);
        return nodeModulesPath;
      }
    } catch {
      // Continue searching up the directory tree
    }
    currentDir = path.dirname(currentDir);
  }

  void logger.warning('No node_modules directory found', {
    searchedPaths,
    startedFrom: absoluteStartDir,
  });

  nodeModulesCache.set(absoluteStartDir, null);
  return null;
}

// Helper to get installed @mastra packages with embedded docs
async function getInstalledMastraPackages(nodeModulesPath: string): Promise<string[]> {
  if (packageCache.has(nodeModulesPath)) {
    void logger.debug('Using cached package list', { count: packageCache.get(nodeModulesPath)!.length });
    return packageCache.get(nodeModulesPath)!;
  }

  void logger.debug('Scanning for @mastra packages', { nodeModulesPath });

  const packages: string[] = [];
  const packagesWithoutDocs: string[] = [];

  try {
    const mastraDir = path.join(nodeModulesPath, '@mastra');
    const entries = await fs.readdir(mastraDir, { withFileTypes: true });

    void logger.debug('Found @mastra directory entries', { count: entries.length });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const docsPath = path.join(mastraDir, entry.name, 'dist', 'docs');
        try {
          await fs.stat(docsPath);
          packages.push(`@mastra/${entry.name}`);
          void logger.debug('Found package with embedded docs', { package: `@mastra/${entry.name}` });
        } catch {
          packagesWithoutDocs.push(`@mastra/${entry.name}`);
        }
      }
    }
  } catch (err) {
    void logger.warning('@mastra directory not found or not accessible', {
      mastraDir: path.join(nodeModulesPath, '@mastra'),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const result = packages.sort();
  packageCache.set(nodeModulesPath, result);

  void logger.info('Package scan complete', {
    packagesWithDocs: result.length,
    packagesWithoutDocs: packagesWithoutDocs.length,
    packages: result,
  });

  return result;
}

// Helper to read SOURCE_MAP.json
async function readSourceMap(nodeModulesPath: string, packageName: string): Promise<SourceMap | null> {
  const cacheKey = `${nodeModulesPath}:${packageName}`;
  if (sourceMapCache.has(cacheKey)) return sourceMapCache.get(cacheKey)!;

  try {
    const sourceMapPath = path.join(nodeModulesPath, packageName, 'dist', 'docs', 'SOURCE_MAP.json');
    const content = await fs.readFile(sourceMapPath, 'utf-8');
    const sourceMap = JSON.parse(content) as SourceMap;
    sourceMapCache.set(cacheKey, sourceMap);
    return sourceMap;
  } catch {
    sourceMapCache.set(cacheKey, null);
    return null;
  }
}

// ============================================================================
// Tool: listInstalledMastraPackages
// ============================================================================

export const listInstalledPackagesTool = {
  name: 'listInstalledMastraPackages',
  description: `List all installed @mastra/* packages that have embedded documentation.
    Use this to discover which Mastra packages are available in the current project.`,
  parameters: z.object({
    projectPath: z.string().describe('Absolute path to the project directory containing node_modules'),
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

    const nodeModulesPath = await findNodeModules(args.projectPath);
    if (!nodeModulesPath) {
      return `No node_modules directory found in the specified project path.

Project path: ${args.projectPath}
Searched up to root looking for node_modules but didn't find any.

Make sure the projectPath points to a directory that contains (or is within) a Node.js project with @mastra/* packages installed.`;
    }

    const packages = await getInstalledMastraPackages(nodeModulesPath);
    if (packages.length === 0) {
      return 'No @mastra/* packages with embedded docs found.';
    }

    return [
      `Found ${packages.length} Mastra package(s) with embedded documentation:`,
      '',
      ...packages.map(pkg => `- ${pkg}`),
      '',
      'Use `readMastraSourceMap` to explore exports for a specific package.',
    ].join('\n');
  },
};

// ============================================================================
// Tool: readMastraSourceMap
// ============================================================================

export const readSourceMapTool = {
  name: 'readMastraSourceMap',
  description: `Read the SOURCE_MAP.json for a Mastra package to discover all exported symbols.
    Shows each export with its type definition and implementation file.`,
  parameters: z.object({
    package: z.string().describe('Package name (e.g., "@mastra/core")'),
    projectPath: z.string().describe('Absolute path to the project directory containing node_modules'),
    filter: z.string().optional().describe('Filter exports by name (case-insensitive)'),
  }),
  execute: async (args: { package: string; projectPath: string; filter?: string }) => {
    void logger.debug('Executing readMastraSourceMap tool', { args });

    const nodeModulesPath = await findNodeModules(args.projectPath);
    if (!nodeModulesPath) return 'No node_modules directory found.';

    const sourceMap = await readSourceMap(nodeModulesPath, args.package);
    if (!sourceMap) return `No SOURCE_MAP.json found for ${args.package}.`;

    let exports = Object.entries(sourceMap.exports);
    if (args.filter) {
      const filterLower = args.filter.toLowerCase();
      exports = exports.filter(([name]) => name.toLowerCase().includes(filterLower));
    }

    if (exports.length === 0) {
      return args.filter
        ? `No exports matching "${args.filter}" in ${args.package}.`
        : `No exports found in ${args.package}.`;
    }

    return [
      `# ${sourceMap.package} v${sourceMap.version}`,
      '',
      `Found ${exports.length} export(s)${args.filter ? ` matching "${args.filter}"` : ''}:`,
      '',
      ...exports.map(([name, info]) => {
        const line = info.line ? `:${info.line}` : '';
        return `- **${name}**: \`${info.implementation}${line}\``;
      }),
    ].join('\n');
  },
};

// ============================================================================
// Tool: findMastraExport
// ============================================================================

export const findExportTool = {
  name: 'findMastraExport',
  description: `Find detailed information about a specific export from a Mastra package.
    Returns type definitions and optionally implementation code.`,
  parameters: z.object({
    package: z.string().describe('Package name (e.g., "@mastra/core")'),
    exportName: z.string().describe('Export name (e.g., "Agent")'),
    includeTypes: z.boolean().optional().default(true).describe('Include type definition'),
    includeImplementation: z.boolean().optional().default(false).describe('Include implementation code'),
    implementationLines: z.number().optional().default(50).describe('Lines of implementation to show'),
    projectPath: z.string().describe('Absolute path to the project directory containing node_modules'),
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

    const nodeModulesPath = await findNodeModules(args.projectPath);
    if (!nodeModulesPath) return 'No node_modules directory found.';

    const sourceMap = await readSourceMap(nodeModulesPath, args.package);
    if (!sourceMap) return `No SOURCE_MAP.json found for ${args.package}.`;

    const exportInfo = sourceMap.exports[args.exportName];
    if (!exportInfo) {
      const match = Object.entries(sourceMap.exports).find(
        ([name]) => name.toLowerCase() === args.exportName.toLowerCase(),
      );
      if (match) return `Export "${args.exportName}" not found. Did you mean "${match[0]}"?`;
      return `Export "${args.exportName}" not found in ${args.package}.`;
    }

    const packagePath = path.join(nodeModulesPath, args.package);
    const output: string[] = [`# ${args.exportName} (${args.package})`, ''];

    if (args.includeTypes !== false) {
      try {
        const typesPath = path.join(packagePath, exportInfo.types);
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
        const implPath = path.join(packagePath, exportInfo.implementation);
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

    return output.join('\n');
  },
};

// ============================================================================
// Tool: readMastraEmbeddedDocs
// ============================================================================

export const readEmbeddedDocsTool = {
  name: 'readMastraEmbeddedDocs',
  description: `Read embedded documentation from a Mastra package.
    Without a topic, lists available topics. With a topic, reads all docs in that folder.`,
  parameters: z.object({
    package: z.string().describe('Package name (e.g., "@mastra/core")'),
    topic: z.string().optional().describe('Topic folder (e.g., "agents", "tools")'),
    file: z.string().optional().describe('Specific file within the topic'),
    projectPath: z.string().describe('Absolute path to the project directory containing node_modules'),
  }),
  execute: async (args: { package: string; projectPath: string; topic?: string; file?: string }) => {
    void logger.debug('Executing readMastraEmbeddedDocs tool', { args });

    const nodeModulesPath = await findNodeModules(args.projectPath);
    if (!nodeModulesPath) return 'No node_modules directory found.';

    const docsPath = path.join(nodeModulesPath, args.package, 'dist', 'docs');

    try {
      await fs.stat(docsPath);
    } catch {
      return `No embedded docs found for ${args.package}.`;
    }

    // List topics if none specified
    if (!args.topic) {
      const entries = await fs.readdir(docsPath, { withFileTypes: true });
      const topics = entries.filter(e => e.isDirectory()).map(e => e.name);
      const files = entries.filter(e => e.isFile()).map(e => e.name);

      return [
        `# ${args.package} Embedded Docs`,
        '',
        '## Files',
        ...files.map(f => `- ${f}`),
        '',
        '## Topics',
        ...topics.map(t => `- ${t}/`),
      ].join('\n');
    }

    const topicPath = path.join(docsPath, args.topic);

    // Read specific file
    if (args.file) {
      try {
        const content = await fs.readFile(path.join(topicPath, args.file), 'utf-8');
        return `# ${args.package}/${args.topic}/${args.file}\n\n${content}`;
      } catch {
        return `File not found: ${args.topic}/${args.file}`;
      }
    }

    // Read all files in topic
    try {
      const entries = await fs.readdir(topicPath, { withFileTypes: true });
      const files = entries.filter(e => e.isFile() && e.name.endsWith('.md')).sort();

      if (files.length === 0) return `No markdown files in ${args.topic}/`;

      const contents: string[] = [`# ${args.package} - ${args.topic}`, ''];
      for (const file of files) {
        const content = await fs.readFile(path.join(topicPath, file.name), 'utf-8');
        contents.push(`## ${file.name}`, '', content, '', '---', '');
      }
      return contents.join('\n');
    } catch {
      return `Topic not found: ${args.topic}`;
    }
  },
};

// ============================================================================
// Tool: searchMastraEmbeddedDocs
// ============================================================================

export const searchEmbeddedDocsTool = {
  name: 'searchMastraEmbeddedDocs',
  description: `Search across all embedded documentation in installed Mastra packages.
    Returns matching excerpts with file paths.`,
  parameters: z.object({
    query: z.string().describe('Search query (case-insensitive)'),
    package: z.string().optional().describe('Limit to a specific package'),
    maxResults: z.number().optional().default(10).describe('Max results (default 10)'),
    projectPath: z.string().describe('Absolute path to the project directory containing node_modules'),
  }),
  execute: async (args: { query: string; projectPath: string; package?: string; maxResults?: number }) => {
    void logger.debug('Executing searchMastraEmbeddedDocs tool', { args });

    const nodeModulesPath = await findNodeModules(args.projectPath);
    if (!nodeModulesPath) return 'No node_modules directory found.';

    const packages = args.package ? [args.package] : await getInstalledMastraPackages(nodeModulesPath);
    if (packages.length === 0) return 'No Mastra packages found.';

    const queryLower = args.query.toLowerCase();
    const results: Array<{ pkg: string; file: string; excerpt: string; score: number }> = [];

    for (const pkg of packages) {
      const docsPath = path.join(nodeModulesPath, pkg, 'dist', 'docs');

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

    if (topResults.length === 0) return `No results for "${args.query}".`;

    return [
      `# Search: "${args.query}"`,
      '',
      `Found ${results.length} result(s):`,
      '',
      ...topResults.map((r, i) => `## ${i + 1}. ${r.pkg} - ${r.file}\n\n\`\`\`\n${r.excerpt}\n\`\`\`\n`),
    ].join('\n');
  },
};

// Export all tools
export const embeddedDocsTools = {
  listInstalledMastraPackages: listInstalledPackagesTool,
  readMastraSourceMap: readSourceMapTool,
  findMastraExport: findExportTool,
  readMastraEmbeddedDocs: readEmbeddedDocsTool,
  searchMastraEmbeddedDocs: searchEmbeddedDocsTool,
};
