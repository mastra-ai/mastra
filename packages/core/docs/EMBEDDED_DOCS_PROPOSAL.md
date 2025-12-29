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
| MCP Docs Server   | `@mastra/mcp-docs-server`   | MCP-based doc access                 |

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

### Per-Package Documentation Structure

Each Mastra package gets a `docs/` folder with topic-organized content:

```
@mastra/core/
├── dist/                          # Existing - compiled code
│   ├── agent/
│   │   ├── agent.d.ts            # Types with JSDoc
│   │   └── index.js              # Re-exports from chunks
│   ├── chunk-IDD63DWQ.js         # Agent implementation
│   ├── chunk-5YYAQUEF.js         # Tools implementation
│   └── ...
├── docs/                          # NEW - embedded docs
│   ├── README.md                  # Navigation index
│   ├── SOURCE_MAP.json            # Machine-readable code map
│   ├── agents/
│   │   ├── 01-overview.md
│   │   ├── 02-creating-agents.md
│   │   ├── 03-tools.md
│   │   └── 04-memory.md
│   ├── tools/
│   │   ├── 01-overview.md
│   │   └── 02-create-tool.md
│   └── workflows/
│       ├── 01-overview.md
│       └── 02-control-flow.md
└── package.json                   # files: ["dist", "docs", ...]

@mastra/memory/
├── dist/
├── docs/
│   ├── README.md
│   ├── SOURCE_MAP.json
│   ├── 01-overview.md
│   ├── 02-message-history.md
│   ├── 03-semantic-recall.md
│   └── 04-working-memory.md
└── package.json

@mastra/libsql/
├── dist/
├── docs/
│   ├── README.md
│   ├── SOURCE_MAP.json
│   ├── 01-storage-setup.md
│   └── 02-vector-search.md
└── package.json
```

### SOURCE_MAP.json - Machine-Readable Code Index

```json
{
  "version": "1.0.0-beta.18",
  "exports": {
    "Agent": {
      "types": "dist/agent/agent.d.ts",
      "implementation": "dist/chunk-IDD63DWQ.js",
      "line": 15137,
      "source": "src/agent/agent.ts"
    },
    "createTool": {
      "types": "dist/tools/index.d.ts",
      "implementation": "dist/chunk-5YYAQUEF.js",
      "line": 258,
      "source": "src/tools/index.ts"
    },
    "Workflow": {
      "types": "dist/workflows/index.d.ts",
      "implementation": "dist/chunk-IDD63DWQ.js",
      "source": "src/workflows/workflow.ts"
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
```

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

| Method        | Description            | Types            | Implementation            |
| ------------- | ---------------------- | ---------------- | ------------------------- |
| `generate()`  | Non-streaming response | `agent.d.ts:150` | `chunk-IDD63DWQ.js:15432` |
| `stream()`    | Streaming response     | `agent.d.ts:180` | `chunk-IDD63DWQ.js:15580` |
| `getMemory()` | Get memory instance    | `agent.d.ts:143` | `chunk-IDD63DWQ.js:15350` |
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
│                         BUILD SCRIPT                                     │
│  scripts/generate-package-docs.ts                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Read MDX files for each topic                                       │
│  2. Strip MDX-specific syntax (imports, components)                     │
│  3. Analyze dist/ to build SOURCE_MAP.json                              │
│  4. Inject code links to .d.ts and .js files                           │
│  5. Output clean Markdown to packages/*/docs/                           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                           │
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
6. **Inject code links** - Add file references to docs
7. **Number files** - `01-overview.md`, `02-creating-agents.md` for ordering

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

## Size Estimates

| Package          | Topics          | Estimated Size |
| ---------------- | --------------- | -------------- |
| `@mastra/core`   | 5 topic folders | ~200KB         |
| `@mastra/memory` | 1 topic folder  | ~30KB          |
| `@mastra/rag`    | 1 topic folder  | ~40KB          |
| `@mastra/evals`  | 1 topic folder  | ~50KB          |
| `@mastra/mcp`    | 1 topic folder  | ~25KB          |
| Storage packages | 1-2 files each  | ~15KB each     |

**Total additional footprint:** ~400KB across all packages (negligible)

---

## How Coding Agents Use This

### Discovery Flow

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

### Example Agent Workflow

**User asks:** "How do I add memory to an agent?"

**Agent actions:**

1. Read `node_modules/@mastra/core/docs/agents/04-memory.md`
2. See code link: `📦 dist/agent/agent.d.ts:143`
3. Read the types to understand the API
4. See implementation link: `🔧 dist/chunk-IDD63DWQ.js:15350`
5. Read the actual code to understand behavior
6. Provide accurate, implementation-aware answer

---

## Implementation Plan

### Phase 1: Prototype (1-2 days)

- [ ] Create `scripts/generate-package-docs.ts`
- [ ] Build SOURCE_MAP.json generator
- [ ] Generate docs for `@mastra/core` as proof of concept
- [ ] Test with Claude/Cursor to validate usefulness

### Phase 2: Full Implementation (3-5 days)

- [ ] Map all MDX topics to packages
- [ ] Handle MDX → Markdown transformation
- [ ] Integrate into build pipeline (`turbo.json`)
- [ ] Add `docs` to all package.json `files` arrays
- [ ] Update CI to generate docs before publish

### Phase 3: Refinement (ongoing)

- [ ] Add more code links based on agent feedback
- [ ] Include example code snippets from source
- [ ] Consider including key source files directly
- [ ] Evaluate if we should publish `src/` for some modules

---

## Alternatives Considered

| Approach                       | Pros                  | Cons                         |
| ------------------------------ | --------------------- | ---------------------------- |
| **MCP Docs Server** (existing) | Rich, interactive     | Requires MCP setup, network  |
| **llms.txt only**              | Simple, small         | Just links, no local content |
| **Full docs in package**       | Everything available  | 3-5MB package size           |
| **This proposal**              | Balanced, code-linked | Requires build pipeline      |

---

## Success Metrics

1. **Coding agent accuracy** - Can agents write correct Mastra code without external docs?
2. **Time to answer** - How quickly can agents find implementation details?
3. **Package size impact** - Stay under 500KB additional per package
4. **Build time impact** - Docs generation under 30 seconds

---

## Open Questions

1. Should we include actual source files (`src/`) for critical modules?
2. How do we handle version drift between docs and code?
3. Should SOURCE_MAP.json be TypeScript-importable?
4. Do we need different detail levels (quick ref vs deep dive)?

---

## Next Steps

1. Review this proposal with the team
2. Decide on Phase 1 scope
3. Assign ownership for build script
4. Create tracking issue

---

_Generated from discussion on embedding docs for coding agents - December 2024_
