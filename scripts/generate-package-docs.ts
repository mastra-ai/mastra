#!/usr/bin/env npx tsx
/**
 * Generates embedded documentation for Mastra packages.
 *
 * Uses docs/build/llms-manifest.json as the data source and copies llms.txt files to a flat structure in each package's dist/docs/references/ directory.
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
`;
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
      console.info(`  Copied: ${entry.path} -> references/${targetFileName}`);
    } else {
      console.warn(`  Warning: Source not found: ${sourcePath}`);
    }
  }
}

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

async function generateDocsForPackage(
  packageName: string,
  packageRoot: string,
  manifest: LlmsManifest,
): Promise<void> {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));
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
  console.info('1. Generating assets/SOURCE_MAP.json...');
  // TODO: Implement SOURCE_MAP.json generation

  // Step 2: Copy documentation files
  console.info('2. Copying documentation files...');
  copyDocumentation(manifest, packageName, docsOutputDir);

  // Step 3: Generate SKILL.md
  console.info('3. Generating SKILL.md...');
  const skillMd = generateSkillMd(packageName, packageJson.version, entries);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');

  console.info(`\nDocumentation generation complete for ${packageName}!`);
}

async function main(): Promise<void> {
  console.info('Loading llms-manifest.json...\n');

  const manifest = loadLlmsManifest();
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Generate for specific package(s)
    for (const packageArg of args) {
      const resolved = resolvePackagePath(packageArg);
      if (resolved) {
        await generateDocsForPackage(resolved.packageName, resolved.packageRoot, manifest);
      }
    }
  } else {
    // Generate for all packages in manifest (except "general")
    const packages = Object.keys(manifest.packages).filter(p => p !== 'general');
    console.info(`Found ${packages.length} packages in manifest\n`);

    for (const pkg of packages) {
      const resolved = resolvePackagePath(pkg);
      if (resolved) {
        await generateDocsForPackage(resolved.packageName, resolved.packageRoot, manifest);
      }
    }
  }
}

// Run if executed directly
main().catch(error => {
  console.error('Failed to generate package docs:', error);
  process.exit(1);
});
