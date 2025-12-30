# Embedded Documentation for Coding Agents

> **Proposal:** Embed documentation inside published npm packages so coding agents can understand and use Mastra as if they were the framework creators.

## Executive Summary

By including curated documentation and code maps directly in our npm packages, we enable AI coding agents to:

- Understand Mastra's architecture without external API calls
- Navigate from concepts → types → implementation seamlessly
- Get version-matched documentation (docs always match installed version)
- Work offline with full framework knowledge

---

## Current State

### What We Have

| Asset             | Location                    | Purpose                              |
| ----------------- | --------------------------- | ------------------------------------ |
| MDX Documentation | `docs/src/content/en/`      | Website docs                         |
| `llms.txt`        | `docs/public/llms.txt`      | Index of all docs with links         |
| `llms-full.txt`   | `docs/public/llms-full.txt` | Full concatenated docs (~107K lines) |
| MCP Docs Server   | `@mastra/mcp-docs-server`   | MCP-based doc access (website)       |

### What Gets Published to npm

```json
// packages/core/package.json
{
  "files": [
    "dist", // Compiled code
    "CHANGELOG.md",
    "./**/*.d.ts" // Type definitions
  ]
}
```

### Key Discovery: Our Built Code is Readable

Unlike many npm packages, Mastra's compiled output is:

- **Unminified** - Clean, readable JavaScript
- **JSDoc preserved** - Comments and examples intact
- **Structured chunks** - `index.js` → `chunk-*.js` pattern
- **Full type definitions** - `.d.ts` files with documentation

Example from `dist/chunk-IDD63DWQ.js`:

````javascript
var Agent = class extends MastraBase {
  id;
  name;
  #instructions;
  /**
   * Creates a new Agent instance with the specified configuration.
   *
   * @example
   * ```typescript
   * import { Agent } from '@mastra/core/agent';
   * // ...
   * ```
   */
  constructor(config) {
    // ...
  }
};
````

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EMBEDDED DOCS (in npm package)                       │
│  node_modules/@mastra/core/docs/                                        │
│  ├── SKILL.md               ← Claude Skills entry point                 │
│  ├── SOURCE_MAP.json        ← Machine-readable navigation               │
│  └── topics/*.md            ← Human & agent readable                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
    ┌───────────────────────┐       ┌─────────────────────────┐
    │   CLAUDE SKILLS       │       │   MCP TOOLS             │
    │   (Anthropic spec)    │       │   (@mastra/mcp-docs-    │
    │                       │       │    server - enhanced)   │
    ├───────────────────────┤       ├─────────────────────────┤
    │ Works in:             │       │ Works with:             │
    │ • Claude.ai           │       │ • Any MCP client        │
    │ • Claude API          │       │ • Any coding agent      │
    │ • Claude Code         │       │ • Any IDE with MCP      │
    │ • Agent SDK           │       │                         │
    └───────────────────────┘       └─────────────────────────┘
```

### Design Principles

1. **Files are the API** - Everything readable as plain files
2. **Universal standards only** - Claude Skills (Anthropic), MCP (open protocol)
3. **No vendor lock-in** - Works without any specific IDE or tool
4. **Progressive enhancement** - Skills/MCP add convenience, not requirements

---

### Per-Package Documentation Structure

Each Mastra package gets a `docs/` folder with topic-organized content:

```
@mastra/core/
├── dist/                          # Existing - compiled code
│   ├── agent/
│   │   ├── agent.d.ts            # Types with JSDoc
│   │   └── index.js              # Re-exports from chunks
│   ├── chunk-IDD63DWQ.js         # Agent implementation (readable!)
│   ├── chunk-5YYAQUEF.js         # Tools implementation
│   └── ...
├── docs/                          # NEW - embedded docs
│   ├── SKILL.md                  # Claude Skills entry point
│   ├── README.md                 # Navigation index
│   ├── SOURCE_MAP.json           # Machine-readable code map
│   ├── agents/
│   │   ├── 01-overview.md
│   │   ├── 02-creating-agents.md
│   │   └── ...
│   ├── tools/
│   └── workflows/
└── package.json                   # files: ["dist", "docs", ...]

@mastra/memory/
├── dist/
├── docs/
│   ├── SKILL.md
│   ├── SOURCE_MAP.json
│   ├── 01-overview.md
│   ├── 02-message-history.md
│   └── ...
└── package.json
```

---

### SKILL.md - Claude Skills Entry Point

Following the [Anthropic Skills specification](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview):

````yaml
---
name: mastra-core-docs
description: Documentation for @mastra/core - an AI agent framework. Use when
  working with Mastra agents, tools, workflows, or when the user asks about
  Mastra APIs. Includes links to type definitions and implementation code.
---

# Mastra Core Documentation

> **Version**: 1.0.0-beta.18
> **Package**: @mastra/core

## Quick Navigation

Use SOURCE_MAP.json to find any export:

```bash
cat docs/SOURCE_MAP.json
````

Each export maps to:

- **types**: `.d.ts` file with JSDoc and API signatures
- **implementation**: `.js` chunk file with readable source
- **docs**: Conceptual documentation

## Finding Documentation

### For a specific export (Agent, createTool, etc.)

```bash
cat docs/SOURCE_MAP.json | grep -A 5 "\"Agent\""
```

### For a topic

```bash
ls docs/
cat docs/agents/01-overview.md
```

## Code Is Readable

Mastra's compiled `.js` files are unminified with JSDoc preserved:

```bash
cat dist/chunk-IDD63DWQ.js | grep -A 50 "var Agent = class"
```

## Available Topics

- [Agents](agents/01-overview.md) - Creating and using AI agents
- [Tools](tools/01-overview.md) - Building custom tools
- [Workflows](workflows/01-overview.md) - Orchestrating flows

````

This enables [progressive disclosure](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview):
- **Level 1**: Metadata loaded at startup (~100 tokens)
- **Level 2**: SKILL.md body loaded when triggered
- **Level 3**: Topic files loaded as needed

---

### SOURCE_MAP.json - Machine-Readable Code Index

```json
{
  "version": "1.0.0-beta.18",
  "package": "@mastra/core",
  "exports": {
    "Agent": {
      "types": "dist/agent/agent.d.ts",
      "implementation": "dist/chunk-IDD63DWQ.js",
      "line": 15137,
      "docs": "docs/agents/01-overview.md"
    },
    "createTool": {
      "types": "dist/tools/index.d.ts",
      "implementation": "dist/chunk-5YYAQUEF.js",
      "line": 258,
      "docs": "docs/tools/01-overview.md"
    },
    "Workflow": {
      "types": "dist/workflows/index.d.ts",
      "implementation": "dist/chunk-IDD63DWQ.js",
      "docs": "docs/workflows/01-overview.md"
    }
  },
  "modules": {
    "agent": {
      "index": "dist/agent/index.js",
      "chunks": ["chunk-IDD63DWQ.js", "chunk-QXL3F3T2.js"]
    },
    "tools": {
      "index": "dist/tools/index.js",
      "chunks": ["chunk-DD2VNRQM.js", "chunk-5YYAQUEF.js"]
    }
  }
}
````

---

### Documentation Format with Code Links

```markdown
# Creating Agents

> 📦 **Types:** `dist/agent/agent.d.ts`
> 🔧 **Implementation:** `dist/chunk-IDD63DWQ.js:15137`

## Overview

Agents are the primary abstraction for AI interactions in Mastra.

## Quick Start

\`\`\`typescript
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
id: "my-agent",
name: "My Agent",
instructions: "You are helpful.",
model: "openai/gpt-4o",
});

const result = await agent.generate("Hello!");
\`\`\`

## Key Methods

| Method        | Description   | Types            | Implementation            |
| ------------- | ------------- | ---------------- | ------------------------- |
| `generate()`  | Non-streaming | `agent.d.ts:150` | `chunk-IDD63DWQ.js:15432` |
| `stream()`    | Streaming     | `agent.d.ts:180` | `chunk-IDD63DWQ.js:15580` |
| `getMemory()` | Get memory    | `agent.d.ts:143` | `chunk-IDD63DWQ.js:15350` |
```

---

## MCP Tools Enhancement

We will enhance the existing `@mastra/mcp-docs-server` package to support embedded docs navigation.

### Current vs Enhanced

| Feature               | Current | Enhanced |
| --------------------- | ------- | -------- |
| Website docs          | ✅      | ✅       |
| Embedded docs         | ❌      | ✅       |
| Package detection     | ❌      | ✅       |
| Implementation lookup | ❌      | ✅       |
| Offline support       | ❌      | ✅       |

### New MCP Tools

#### `list_installed_packages`

List all installed Mastra packages with embedded docs.

```typescript
// Returns: [@mastra/core@1.0.0, @mastra/memory@1.0.0, ...]
```

#### `read_source_map`

Read the SOURCE_MAP.json for a package.

```typescript
await client.callTool('read_source_map', {
  package: '@mastra/core',
});
```

#### `find_export`

Find documentation and code locations for a specific export.

```typescript
await client.callTool('find_export', {
  exportName: 'Agent',
  package: '@mastra/core', // optional, defaults to @mastra/core
});

// Returns:
// {
//   types: 'dist/agent/agent.d.ts',
//   implementation: 'dist/chunk-IDD63DWQ.js',
//   line: 15137,
//   docs: 'docs/agents/01-overview.md'
// }
```

#### `read_implementation`

Read the implementation code for an export.

```typescript
await client.callTool('read_implementation', {
  exportName: 'Agent',
  context: 100, // lines of context
});

// Returns the code around the class definition
```

#### `search_embedded_docs`

Search across all embedded documentation.

```typescript
await client.callTool('search_embedded_docs', {
  query: 'memory integration',
});
```

---

## Build Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SOURCE                                        │
│  docs/src/content/en/docs/agents/*.mdx                                  │
│  docs/src/content/en/reference/agents/*.mdx                             │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUILD SCRIPT                                    │
│  scripts/generate-package-docs.ts                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Read MDX files for each topic                                       │
│  2. Strip MDX-specific syntax (imports, components)                     │
│  3. Analyze dist/ to build SOURCE_MAP.json                              │
│  4. Generate SKILL.md with proper YAML frontmatter                      │
│  5. Inject code links to .d.ts and .js files                            │
│  6. Output to packages/*/docs/                                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                          │
│  packages/core/docs/                                                    │
│  packages/memory/docs/                                                  │
│  packages/rag/docs/                                                     │
│  stores/libsql/docs/                                                    │
│  ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Build Script Responsibilities

1. **Parse MDX** - Extract content, strip React components
2. **Map topics to packages** - `agents/*.mdx` → `@mastra/core`
3. **Analyze dist/** - Parse `index.js` files to find chunk mappings
4. **Find line numbers** - Grep for class/function definitions in chunks
5. **Generate SOURCE_MAP.json** - Machine-readable export index
6. **Generate SKILL.md** - Claude Skills entry point with YAML frontmatter
7. **Inject code links** - Add file references to docs
8. **Number files** - `01-overview.md`, `02-creating-agents.md` for ordering

---

## Package Mapping

| Package          | Doc Topics                                               | Source MDX                                                                      |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `@mastra/core`   | agents, tools, workflows, streaming, observability       | `docs/agents/`, `docs/tools-mcp/`, `docs/workflows/`, `reference/agents/`, etc. |
| `@mastra/memory` | memory, message history, semantic recall, working memory | `docs/memory/`, `reference/memory/`                                             |
| `@mastra/rag`    | chunking, embedding, retrieval, reranking, graph-rag     | `docs/rag/`, `reference/rag/`                                                   |
| `@mastra/evals`  | scorers, custom scorers, CI integration                  | `docs/evals/`, `reference/evals/`                                               |
| `@mastra/mcp`    | MCP client, MCP server, publishing                       | `docs/mcp/`, `reference/tools/mcp-*`                                            |
| `@mastra/libsql` | libsql storage, vector search                            | `reference/storage/libsql`, `reference/vectors/libsql`                          |
| `@mastra/pg`     | postgres storage, pgvector                               | `reference/storage/postgresql`, `reference/vectors/pg`                          |

---

## How Coding Agents Use This

### Direct File Access (Universal)

Any agent with file access can read the docs:

```bash
# 1. Find the docs
cat node_modules/@mastra/core/docs/README.md

# 2. Read conceptual overview
cat node_modules/@mastra/core/docs/agents/01-overview.md

# 3. Get machine-readable source map
cat node_modules/@mastra/core/docs/SOURCE_MAP.json

# 4. Jump to types (API + JSDoc)
cat node_modules/@mastra/core/dist/agent/agent.d.ts

# 5. Jump to implementation
cat node_modules/@mastra/core/dist/chunk-IDD63DWQ.js | head -500

# 6. Search for specific method
grep -n "async generate" node_modules/@mastra/core/dist/chunk-IDD63DWQ.js
```

### Claude Skills (Automatic)

Claude automatically discovers and uses SKILL.md when relevant:

1. User asks about Mastra
2. Claude reads `docs/SKILL.md` (Level 2)
3. Claude reads `docs/SOURCE_MAP.json` as needed (Level 3)
4. Claude reads specific topic files as needed (Level 3)

### MCP Tools (Enhanced)

For richer programmatic access via `@mastra/mcp-docs-server`:

```typescript
// Find the Agent class
const result = await client.callTool('find_export', {
  exportName: 'Agent',
});

// Read the implementation
const code = await client.callTool('read_implementation', {
  exportName: 'Agent',
  context: 100,
});
```

---

## Implementation Plan

### Phase 1: Embedded Docs Foundation ✅

- [x] Create `scripts/generate-package-docs.ts`
- [x] Build SOURCE_MAP.json generator (analyze dist/)
- [x] Generate SKILL.md with Anthropic-compatible YAML frontmatter
- [x] Generate docs for `@mastra/core` as proof of concept
- [ ] Test with Claude to validate Skills discovery _(deferred)_
- [x] Test with direct file reading

### Phase 2: Full Package Coverage

- [x] Map all MDX topics to packages _(via per-package `docs.config.json`)_
- [x] Handle MDX → Markdown transformation _(code blocks preserved, components stripped)_
- [x] Add `postbuild` script to each package (per package, as needed)
- [x] Add `docs.config.json` to each package (per package, as needed)

### Phase 3: MCP Tools Enhancement

- [x] Add embedded docs tools to `@mastra/mcp-docs-server`
- [x] Implement `listInstalledMastraPackages`
- [x] Implement `readMastraSourceMap`
- [x] Implement `findMastraExport`
- [x] Implement `readMastraEmbeddedDocs`
- [x] Implement `searchMastraEmbeddedDocs`

### Phase 4: Refinement

- [ ] Add more code links based on agent feedback
- [ ] Optimize progressive loading
- [ ] Consider including key source files directly
- [ ] Gather usage metrics and iterate

---

## References

- [How to Add Embedded Docs to a Package](../../../EMBEDDED_DOCS.md)
- [Anthropic Agent Skills Specification](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Existing MCP Docs Server](../../../packages/mcp-docs-server/)
