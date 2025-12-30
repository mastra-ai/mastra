# Embedded Documentation for Packages

This guide explains how embedded documentation works in Mastra packages, enabling coding agents to understand and use the framework effectively.

## Overview

Embedded docs are generated from MDX source files and included in published npm packages. They provide:

- **SKILL.md** - Entry point with navigation instructions
- **SOURCE_MAP.json** - Machine-readable index of exports → types → implementation
- **Topic markdown files** - Conceptual documentation with code references

## How It Works

Documentation is driven by **frontmatter in MDX files**. When you add a `packages` field to an MDX file, it will be included in that package's embedded docs:

```yaml
---
title: "Memory Overview"
description: "Learn about Mastra's memory system"
packages:
  - "@mastra/memory"
  - "@mastra/core"
---
```

The `generate-package-docs.ts` script:
1. Scans all MDX files in `docs/src/content/en/`
2. Filters files by the `packages` frontmatter field
3. Groups files into topics based on folder structure
4. Generates embedded docs in `dist/docs/`

## Adding Docs for a Package

### Step 1: Add `packages` frontmatter to MDX files

Edit the relevant MDX files in `docs/src/content/en/` and add the `packages` field:

```yaml
---
title: "Your Doc Title"
description: "Description here"
packages:
  - "@mastra/your-package"
---
```

A file can belong to multiple packages - just list them all.

### Step 2: Add `postbuild` script to package.json

```json
{
  "scripts": {
    "build": "your-existing-build-command",
    "postbuild": "pnpx tsx ../../scripts/generate-package-docs.ts @mastra/your-package"
  }
}
```

Adjust the path based on your package location:
- `packages/memory` → `../../scripts/generate-package-docs.ts`
- `stores/libsql` → `../../scripts/generate-package-docs.ts`

### Step 3: Build and verify

```bash
pnpm build
```

Check the generated files in `dist/docs/`:

```
your-package/dist/docs/
├── SKILL.md           # Entry point
├── README.md          # Navigation index
├── SOURCE_MAP.json    # Machine-readable export index
└── memory/
    ├── 01-overview.md
    ├── 02-message-history.md
    └── ...
```

## Topic Organization

Topics are automatically derived from the folder structure:

| MDX Path | Topic |
|----------|-------|
| `reference/memory/overview.mdx` | `memory` |
| `docs/agents/overview.mdx` | `agents` |
| `reference/workflows/step.mdx` | `workflows` |

Files within a topic are sorted: `overview` and `index` files come first, then alphabetically.

## Code References

Code references are **auto-discovered** from the MDX content by scanning for:

1. **Import statements**: `import { Memory } from "@mastra/memory"`
2. **Inline code**: `` `Memory` ``
3. **Function calls**: `new Memory(`, `createMemory(`

These are matched against the package's exports in `SOURCE_MAP.json` and linked to their type definitions and implementation files.

## Running the Script

```bash
# Generate for a specific package
pnpx tsx scripts/generate-package-docs.ts @mastra/core

# Or use path format
pnpx tsx scripts/generate-package-docs.ts packages/core

# Generate for all packages with docs
pnpx tsx scripts/generate-package-docs.ts
```

## How Agents Use Embedded Docs

### Direct File Access

```bash
# Read the skill overview
cat node_modules/@mastra/core/dist/docs/SKILL.md

# Get the source map
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json

# Read a topic
cat node_modules/@mastra/core/dist/docs/agents/01-overview.md

# Jump to implementation
cat node_modules/@mastra/core/dist/chunk-*.js | grep -A 50 "var Agent = class"
```

### Key Insight

Mastra's compiled JavaScript is **unminified and readable**. Agents can read the actual implementation directly from the `.js` chunk files referenced in `SOURCE_MAP.json`.
