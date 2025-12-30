# Embedded Documentation for Packages

This guide explains how to add embedded documentation to Mastra packages, enabling coding agents to understand and use the framework effectively.

## Overview

Embedded docs are generated from MDX source files and included in published npm packages. They provide:

- **SKILL.md** - Claude Skills entry point for automatic discovery
- **SOURCE_MAP.json** - Machine-readable index of exports → types → implementation
- **Topic markdown files** - Conceptual documentation with code references

## Adding Embedded Docs to a Package

### Step 1: Create `docs.config.json`

Create a `docs.config.json` file in your package root:

```json
{
  "skillName": "mastra-memory-docs",
  "skillDescription": "Documentation for @mastra/memory - message history, semantic recall, and working memory for AI agents.",
  "topics": [
    {
      "id": "memory",
      "title": "Memory",
      "sourceFiles": ["docs/memory/overview.mdx", "docs/memory/message-history.mdx", "docs/memory/semantic-recall.mdx"]
    }
  ]
}
```

### Config Options

| Field                     | Required | Description                                                 |
| ------------------------- | -------- | ----------------------------------------------------------- |
| `skillName`               | No       | Name for Claude Skills (defaults to package name)           |
| `skillDescription`        | No       | Description for Claude Skills discovery                     |
| `modules`                 | No       | List of dist/ modules to analyze (auto-detected if omitted) |
| `topics`                  | Yes      | Array of documentation topics                               |
| `topics[].id`             | Yes      | Unique ID, becomes folder name in docs/                     |
| `topics[].title`          | Yes      | Human-readable title                                        |
| `topics[].sourceFiles`    | Yes      | MDX files from `docs/src/content/en/`                       |
| `topics[].codeReferences` | No       | Override auto-discovered code references                    |

### Step 2: Add `docs` to `package.json` files array

```json
{
  "files": ["dist", "CHANGELOG.md", "./**/*.d.ts", "docs"]
}
```

### Step 3: Add `generate:docs` script

```json
{
  "scripts": {
    "generate:docs": "pnpx tsx ../../scripts/generate-package-docs.ts packages/memory"
  }
}
```

Adjust the path based on your package location:

- `packages/memory` → `../../scripts/generate-package-docs.ts packages/memory`
- `stores/libsql` → `../../scripts/generate-package-docs.ts stores/libsql`

### Step 4: Run generation

```bash
# From package directory
pnpm generate:docs

# Or from monorepo root
pnpm --filter @mastra/memory generate:docs

# Or generate for all packages with configs
pnpm generate:docs
```

### Step 5: Verify output

Check the generated files:

```
your-package/docs/
├── SKILL.md           # Claude Skills entry point
├── README.md          # Navigation index
├── SOURCE_MAP.json    # Machine-readable export index
└── memory/
    ├── 01-overview.md
    ├── 02-message-history.md
    └── ...
```

## Code References

Code references are **auto-discovered** from the MDX source files by scanning for:

1. **Import statements**: `import { Memory } from "@mastra/memory"`
2. **Inline code**: `` `Memory` ``
3. **Function calls**: `new Memory(`, `createMemory(`

These are matched against the package's exports in `SOURCE_MAP.json` and linked to their type definitions and implementation files.

### Override Auto-Discovery

To specify exact code references, add `codeReferences` to a topic:

```json
{
  "id": "memory",
  "title": "Memory",
  "sourceFiles": ["docs/memory/overview.mdx"],
  "codeReferences": ["Memory", "MessageHistory", "WorkingMemory"]
}
```

## Build Pipeline Integration

The `generate:docs` task is configured in `turbo.json`:

```json
{
  "generate:docs": {
    "dependsOn": ["build"],
    "outputs": ["docs/**"],
    "inputs": ["docs.config.json", "../../docs/src/content/en/**/*.mdx"]
  }
}
```

This ensures:

- Docs are generated **after** build (so `dist/` exists for SOURCE_MAP)
- Output is cached based on config and MDX changes

## Example: @mastra/core

See `packages/core/docs.config.json` for a complete example with 8 topics:

- agents
- tools
- workflows
- streaming
- mastra
- server
- observability
- processors

## How Agents Use Embedded Docs

### Direct File Access

```bash
# Read the skill overview
cat node_modules/@mastra/core/docs/SKILL.md

# Get the source map
cat node_modules/@mastra/core/docs/SOURCE_MAP.json

# Read a topic
cat node_modules/@mastra/core/docs/agents/01-overview.md

# Jump to implementation
cat node_modules/@mastra/core/dist/chunk-IDD63DWQ.js | grep -A 50 "var Agent = class"
```

### Claude Skills

### MCP Tools

The `@mastra/mcp-docs-server` package provides enhanced access via MCP protocol (Phase 3).
