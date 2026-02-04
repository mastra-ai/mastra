#!/usr/bin/env npx tsx
/**
 * Generates embedded documentation for Mastra packages.
 *
 * Uses docs/build/llms-manifest.json as the data source and copies llms.txt files to a flat structure in each package's dist/docs/references/ directory.
 *
 * Usage:
 * Add "build:docs": "pnpx tsx ../../scripts/generate-package-docs.ts", to your package.json scripts.
 * (Adjust the file path as needed based on your package location)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.join(__dirname, '..');

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

interface ManifestEntry {
  path: string; // e.g., "docs/agents/adding-voice/llms.txt"
  title: string;
  description?: string;
  category: string; // "docs", "reference", "guides", "models"
  folderPath: string; // e.g., "agents/adding-voice"
}

interface LlmsManifest {
  version: string;
  generatedAt: string;
  packages: Record<string, ManifestEntry[]>;
}

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

  // Make sure it's a file, not a directory
  const stat = fs.statSync(chunkPath);
  if (!stat.isFile()) {
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
  const packageJson = getPackageJson(packageRoot);

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

function loadLlmsManifest(): LlmsManifest {
  const manifestPath = path.join(MONOREPO_ROOT, 'docs/build/llms-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('docs/build/llms-manifest.json not found. Run docs build first.');
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

function generateFlatFileName(entry: ManifestEntry): string {
  // Convert: { category: "docs", folderPath: "agents/adding-voice" }
  // To: "docs-agents-adding-voice.md"

  if (!entry.folderPath) {
    // Root level doc: just use category
    return `${entry.category}.md`;
  }

  const pathPart = entry.folderPath.replace(/\//g, '-');
  return `${entry.category}-${pathPart}.md`;
}

function generateSkillMd(packageName: string, version: string, entries: ManifestEntry[]): string {
  // Generate compliant name: lowercase, hyphens, max 64 chars
  // "@mastra/core" -> "mastra-core"
  const skillName = packageName.replace('@', '').replace('/', '-').toLowerCase();

  // Generate description (max 1024 chars)
  const description = `Documentation for ${packageName}. Use when working with ${packageName} APIs, configuration, or implementation.`;

  // Group entries by category
  const grouped = new Map<string, ManifestEntry[]>();
  for (const entry of entries) {
    const cat = entry.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(entry);
  }

  // Generate documentation list
  let docList = '';
  for (const [category, catEntries] of grouped) {
    docList += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    for (const entry of catEntries) {
      const fileName = generateFlatFileName(entry);
      docList += `- [${entry.title}](references/${fileName})${entry.description ? ` - ${entry.description}` : ''}\n`;
    }
  }

  return `---
name: ${skillName}
description: ${description}
metadata:
  package: "${packageName}"
  version: "${version}"
---

## When to use

Use this skill whenever you are working with ${packageName} to obtain the domain-specific knowledge.

## How to use

Read the individual reference documents for detailed explanations and code examples.
${docList}

Read [assets/SOURCE_MAP.json](assets/SOURCE_MAP.json) for source code references.`;
}

function copyDocumentation(manifest: LlmsManifest, packageName: string, docsOutputDir: string): void {
  const entries = manifest.packages[packageName] || [];
  const referencesDir = path.join(docsOutputDir, 'references');

  fs.mkdirSync(referencesDir, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(MONOREPO_ROOT, 'docs/build', entry.path);
    const targetFileName = generateFlatFileName(entry);
    const targetPath = path.join(referencesDir, targetFileName);

    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      fs.writeFileSync(targetPath, content, 'utf-8');
    } else {
      console.warn(`  Warning: Source not found: ${sourcePath}`);
    }
  }
}

function getPackageJson(packageRoot: string): { name: string; version: string } {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found in ${packageRoot}`);
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}

async function generateDocsForPackage(
  packageName: string,
  packageRoot: string,
  manifest: LlmsManifest,
): Promise<void> {
  const packageJson = getPackageJson(packageRoot);
  const docsOutputDir = path.join(packageRoot, 'dist', 'docs');
  const entries = manifest.packages[packageName];

  if (!entries || entries.length === 0) {
    console.warn(`No documentation found for ${packageName} in manifest`);
    return;
  }

  console.info(`\nGenerating documentation for ${packageName} (${entries.length} files)\n`);

  // Clean and create directory structure
  if (fs.existsSync(docsOutputDir)) {
    fs.rmSync(docsOutputDir, { recursive: true });
  }
  fs.mkdirSync(path.join(docsOutputDir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(docsOutputDir, 'assets'), { recursive: true });

  // Step 1: Generate SOURCE_MAP.json in assets/
  const sourcemap = generateSourceMap(packageRoot);
  fs.writeFileSync(path.join(docsOutputDir, 'assets', 'SOURCE_MAP.json'), JSON.stringify(sourcemap, null, 2), 'utf-8');

  // Step 2: Copy documentation files
  copyDocumentation(manifest, packageName, docsOutputDir);

  // Step 3: Generate SKILL.md
  const skillMd = generateSkillMd(packageName, packageJson.version, entries);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');
}

async function main(): Promise<void> {
  const manifest = loadLlmsManifest();
  const packageRoot = process.cwd()
  const packageName = getPackageJson(packageRoot).name;

  await generateDocsForPackage(packageName, packageRoot, manifest);
}

main().catch(error => {
  console.error('Failed to generate package docs:', error);
  process.exit(1);
});
