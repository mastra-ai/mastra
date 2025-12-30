---
name: mastra-core-docs
description: Documentation for @mastra/core - an AI agent framework. Use when working with Mastra agents, tools, workflows, streaming, or when the user asks about Mastra APIs. Includes links to type definitions and readable implementation code in dist/.
---

# Mastra Core Documentation

> **Version**: 1.0.0-beta.18
> **Package**: @mastra/core

## Quick Navigation

Use SOURCE_MAP.json to find any export:

```bash
cat docs/SOURCE_MAP.json
```

Each export maps to:

- **types**: `.d.ts` file with JSDoc and API signatures
- **implementation**: `.js` chunk file with readable source
- **docs**: Conceptual documentation in `docs/`

## Finding Documentation

### For a specific export (Agent, createTool, Workflow, etc.)

```bash
# Read the source map
cat docs/SOURCE_MAP.json | grep -A 5 '"Agent"'

# This tells you:
# - types: dist/agent/index.d.ts
# - implementation: dist/chunk-*.js with line number
```

### For a topic (agents, tools, workflows)

```bash
# List topics
ls docs/

# Read a topic
cat docs/agents/01-overview.md
```

## Code References Are Unminified

Mastra's compiled `.js` files in `dist/` are:

- Unminified with readable code
- Preserve JSDoc comments and examples
- Include implementation details

You can read them directly:

```bash
# See what a module exports (tells you which chunks)
cat dist/agent/index.js

# Read the implementation
cat dist/chunk-IDD63DWQ.js | grep -A 50 "var Agent = class"
```

## Top Exports

- Agent: dist/agent/agent.d.ts
- TripWire: dist/agent/index.d.ts
- isSupportedLanguageModel: dist/agent/index.d.ts
- resolveThreadIdFromArgs: dist/agent/index.d.ts
- supportedLanguageModelSpecifications: dist/agent/index.d.ts
- tryGenerateWithJsonFallback: dist/agent/index.d.ts
- tryStreamWithJsonFallback: dist/agent/index.d.ts
- MessageList: dist/agent/index.d.ts
- convertMessages: dist/agent/index.d.ts
- ToolStream: dist/tools/index.d.ts
- Tool: dist/tools/tool.d.ts
- createTool: dist/tools/index.d.ts
- isVercelTool: dist/tools/index.d.ts
- DefaultExecutionEngine: dist/workflows/index.d.ts
- ExecutionEngine: dist/workflows/index.d.ts
- Run: dist/workflows/index.d.ts
- Workflow: dist/workflows/workflow.d.ts
- cloneStep: dist/workflows/index.d.ts
- cloneWorkflow: dist/workflows/index.d.ts
- createDeprecationProxy: dist/workflows/index.d.ts

See SOURCE_MAP.json for the complete list.

## Available Topics

- [Agents](agents/01-overview.md) - Creating and using AI agents
- [Tools](tools/01-overview.md) - Building custom tools
- [Workflows](workflows/01-overview.md) - Orchestrating complex flows
- [Streaming](streaming/01-overview.md) - Real-time responses

## Using Type Definitions

Type files (`.d.ts`) include full JSDoc documentation:

```bash
cat dist/agent/agent.d.ts
```

## Using Implementation Files

Implementation files show actual logic:

```bash
# Find where exports come from
cat dist/agent/index.js

# Read the chunk (unminified, readable!)
cat dist/chunk-IDD63DWQ.js
```
