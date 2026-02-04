# Plan: Update Embedded Docs Generation for Agent Skills Compliance

## Summary

Rewrite `scripts/generate-package-docs.ts` to:
1. Use `docs/build/llms-manifest.json` as the data source (instead of scanning MDX files)
2. Copy and rename `llms.txt` files to markdown in a flat structure
3. Generate Agent Skills compliant output structure
4. Move SOURCE_MAP.json to `assets/` directory
5. Store docs in `references/` directory with flat naming

## Current vs New Structure

```
# CURRENT                           # NEW (Agent Skills compliant)
packages/mcp/dist/docs/             packages/mcp/dist/docs/
├── SKILL.md                        ├── SKILL.md           (updated format)
├── README.md                       ├── references/        (flat structure)
├── SOURCE_MAP.json                 │   ├── docs-mcp-overview.md
├── mcp/                            │   ├── docs-mcp-publishing.md
│   ├── 01-overview.md              │   ├── reference-tools-mcp-client.md
│   └── 02-publishing.md            │   └── ...
└── tools/                          └── assets/
    └── 01-reference.md                 └── SOURCE_MAP.json
```

## Implementation Steps

### Step 1: Add New Interfaces and Manifest Loader

Add at top of script (after existing types around line 63):

```typescript
interface ManifestEntry {
  path: string;       // e.g., "docs/agents/adding-voice/llms.txt"
  title: string;
  category: string;   // "docs", "reference", "guides", "models"
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
```

### Step 2: Add Flat File Naming Function

```typescript
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
```

### Step 3: Update SKILL.md Generator for Agent Skills Compliance

The current `generateSkillMd` function (lines 558-603) needs updates:

```typescript
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
      docList += `- [${entry.title}](references/${fileName})\n`;
    }
  }

  return `---
name: ${skillName}
description: ${description}
metadata:
  package: "${packageName}"
  version: "${version}"
---

# ${packageName} Documentation

Version: ${version}

## Quick Reference

Use \`assets/SOURCE_MAP.json\` to find code exports and their source locations.

## Available Documentation
${docList}

## Directory Structure

- \`references/\` - Documentation files
- \`assets/SOURCE_MAP.json\` - Maps exports to source files
`;
}
```

### Step 4: Add Documentation Copy Function

```typescript
function copyDocumentation(
  manifest: LlmsManifest,
  packageName: string,
  docsOutputDir: string
): void {
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
```

### Step 5: Update Main Function

Replace the current `generateDocsForPackage` function (lines 800-853):

```typescript
async function generateDocsForPackage(
  packageName: string,
  packageRoot: string,
  manifest: LlmsManifest
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
  const sourceMap = generateSourceMap(packageRoot);
  fs.writeFileSync(
    path.join(docsOutputDir, 'assets', 'SOURCE_MAP.json'),
    JSON.stringify(sourceMap, null, 2),
    'utf-8'
  );

  // Step 2: Copy documentation files
  console.info('2. Copying documentation files...');
  copyDocumentation(manifest, packageName, docsOutputDir);

  // Step 3: Generate SKILL.md
  console.info('3. Generating SKILL.md...');
  const skillMd = generateSkillMd(packageName, packageJson.version, entries);
  fs.writeFileSync(path.join(docsOutputDir, 'SKILL.md'), skillMd, 'utf-8');

  console.info(`\nDocumentation generation complete for ${packageName}!`);
}
```

### Step 6: Update main() Entry Point

Replace the current `main` function (lines 855-888):

```typescript
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
```

### Step 7: Remove Unused Code

Delete the following functions that are no longer needed:
- `parseSidebarOrder` (lines 69-90)
- `getSidebarOrder` (lines 92-116)
- `getFileOrder` (lines 118-147)
- `extractFrontmatter` (lines 153-188)
- `findMdxFiles` (lines 190-221)
- `getFilesForPackage` (lines 223-225)
- `groupFilesIntoTopics` (lines 227-286)
- `transformMdxToMarkdown` (lines 446-511)
- `extractCodeReferencesFromContent` (lines 517-552)
- `generateReadme` (lines 605-640)
- `processDocTopic` (lines 646-733)
- `getAllPackagesWithDocs` (lines 786-794)

Also remove the `sidebarOrderCache` variable and `MDX_DOCS_DIR` constant.

## Files to Modify

| File | Change |
|------|--------|
| `scripts/generate-package-docs.ts` | Complete rewrite per steps above |

## Verification

After implementation, run:

```bash
# Build docs first (if not already built)
cd docs && pnpm build

# Generate for a single package
pnpm generate:docs @mastra/mcp

# Verify structure
ls -la packages/mcp/dist/docs/
ls -la packages/mcp/dist/docs/references/
ls -la packages/mcp/dist/docs/assets/

# Verify SKILL.md format
head -20 packages/mcp/dist/docs/SKILL.md

# Check file count matches manifest entries
cat docs/build/llms-manifest.json | jq '.packages["@mastra/mcp"] | length'
ls packages/mcp/dist/docs/references/ | wc -l
```

## Agent Skills Compliance Checklist

- [ ] SKILL.md at root of skill directory
- [ ] `name` field: lowercase, hyphens only, max 64 chars
- [ ] `description` field: max 1024 chars
- [ ] `references/` directory for documentation
- [ ] `assets/` directory for SOURCE_MAP.json
- [ ] Flat file structure (no nested folders in references/)
