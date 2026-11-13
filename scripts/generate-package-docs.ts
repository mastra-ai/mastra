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
import { generateSourceMap } from './package-docs-source-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MONOREPO_ROOT = path.join(__dirname, '..');

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

// Cache for file existence checks
const existsCache = new Map<string, boolean>();

function cachedExists(filePath: string): boolean {
  const cached = existsCache.get(filePath);
  if (cached !== undefined) return cached;
  const exists = fs.existsSync(filePath);
  existsCache.set(filePath, exists);
  return exists;
}

function loadLlmsManifest(): LlmsManifest {
  const manifestPath = path.join(MONOREPO_ROOT, 'docs/build/llms-manifest.json');
  if (!cachedExists(manifestPath)) {
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

    if (cachedExists(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      console.warn(`  Warning: Source not found: ${sourcePath}`);
    }
  }
}

// Cache for package.json contents
const packageJsonCache = new Map<string, { name: string; version: string }>();

function getPackageJson(packageRoot: string): { name: string; version: string } {
  const cached = packageJsonCache.get(packageRoot);
  if (cached) return cached;

  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!cachedExists(packageJsonPath)) {
    throw new Error(`package.json not found in ${packageRoot}`);
  }
  const result = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  packageJsonCache.set(packageRoot, result);
  return result;
}

function generateDocsForPackage(packageName: string, packageRoot: string, manifest: LlmsManifest): void {
  const packageJson = getPackageJson(packageRoot);
  const docsOutputDir = path.join(packageRoot, 'dist', 'docs');
  const entries = manifest.packages[packageName];

  if (!entries || entries.length === 0) {
    console.warn(`No documentation found for ${packageName} in manifest`);
    return;
  }

  console.info(`\nGenerating documentation for ${packageName} (${entries.length} files)\n`);

  // Clean and create directory structure
  if (cachedExists(docsOutputDir)) {
    fs.rmSync(docsOutputDir, { recursive: true });
    // Clear from cache since we deleted it
    existsCache.delete(docsOutputDir);
  }
  fs.mkdirSync(path.join(docsOutputDir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(docsOutputDir, 'assets'), { recursive: true });

  // Step 1: Generate SOURCE_MAP.json in assets/
  const sourcemap = generateSourceMap(packageRoot, packageJson);
  fs.writeFileSync(path.join(docsOutputDir, 'assets', 'SOURCE_MAP.json'), JSON.stringify(sourcemap, null, 2), 'utf-8');

  // Step 2: Copy documentation files
  copyDocumentation(manifest, packageName, docsOutputDir);

  // Step 3: Generate SKILL.md
  const skillMd = generateSkillMd(packageName, packageJson.version, entries);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');
}

function main(): void {
  const manifest = loadLlmsManifest();
  const packageRoot = process.cwd();
  const packageName = getPackageJson(packageRoot).name;

  generateDocsForPackage(packageName, packageRoot, manifest);
}

try {
  main();
} catch (error) {
  if (process.env.REQUIRE_PACKAGE_DOCS) {
    console.error('Failed to generate package docs:', error);
    process.exit(1);
  }
  console.warn('Skipping package docs generation:', (error as Error).message);
}
