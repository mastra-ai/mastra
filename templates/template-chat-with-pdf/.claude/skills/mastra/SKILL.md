---
name: mastra
description: "Comprehensive Mastra framework guide. Teaches how to find current documentation, verify API signatures, and build agents and workflows. Covers documentation lookup strategies (embedded docs, remote docs), core concepts (agents vs workflows, tools, memory, RAG), TypeScript requirements, and common patterns. Use this skill for all Mastra development to ensure you're using current APIs from the installed version or latest documentation."
license: Apache-2.0
metadata:
  author: Mastra
  version: "2.0.0"
  repository: https://github.com/mastra-ai/skills
---

# Mastra Framework Guide

Build AI applications with Mastra. This skill teaches you how to find current documentation and build agents and workflows.

## ⚠️ Critical: Do not trust internal knowledge

**Everything you know about Mastra is likely outdated or wrong. Never rely on memory. Always verify against current documentation.**

Your training data contains obsolete APIs, deprecated patterns, and incorrect usage. Mastra evolves rapidly - APIs change between versions, constructor signatures shift, and patterns get refactored.

## Prerequisites

**Before writing any Mastra code**, check if packages are installed:

```bash
ls node_modules/@mastra/
```

- **If packages exist:** Use embedded docs first (most reliable)
- **If no packages:** Install first or use remote docs

## Documentation lookup guide

### Quick Reference

| User Question                       | First Check                                                      | How To                                         |
| ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| "Create/install Mastra project"     | [`references/create-mastra.md`](references/create-mastra.md)     | Setup guide with CLI and manual steps          |
| "How do I use Agent/Workflow/Tool?" | [`references/embedded-docs.md`](references/embedded-docs.md)     | Look up in `node_modules/@mastra/*/dist/docs/` |
| "How do I use X?" (no packages)     | [`references/remote-docs.md`](references/remote-docs.md)         | Fetch from `https://mastra.ai/llms.txt`        |
| "I'm getting an error..."           | [`references/common-errors.md`](references/common-errors.md)     | Common errors and solutions                    |
| "Upgrade from v0.x to v1.x"         | [`references/migration-guide.md`](references/migration-guide.md) | Version upgrade workflows                      |

### Priority order for writing code

⚠️ **Never write code without checking current docs first**

1. **Embedded docs first** (if packages installed)

   ```bash
   # Check what's available
   cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"Agent"'

   # Read the actual type definition
   cat node_modules/@mastra/core/dist/[path-from-source-map]
   ```

   - **Why:** Matches your EXACT installed version
   - **Most reliable source of truth**
   - **See:** [`references/embedded-docs.md`](references/embedded-docs.md)

2. **Remote docs second** (if packages not installed)

   ```bash
   # Fetch latest docs
   # https://mastra.ai/llms.txt
   ```

   - **Why:** Latest published docs (may be ahead of installed version)
   - **Use when:** Packages not installed or exploring new features
   - **See:** [`references/remote-docs.md`](references/remote-docs.md)

## Core concepts

### Agents vs workflows

**Agent**: Autonomous, makes decisions, uses tools
Use for: Open-ended tasks (support, research, analysis)

**Workflow**: Structured sequence of steps
Use for: Defined processes (pipelines, approvals, ETL)

### Key components

- **Tools**: Extend agent capabilities (APIs, databases, external services)
- **Memory**: Maintain context (message history, working memory, semantic recall)
- **RAG**: Query external knowledge (vector stores, graph relationships)
- **Storage**: Persist data (Postgres, LibSQL, MongoDB)

## Critical requirements

### TypeScript config

Mastra requires **ES2022 modules**. CommonJS will fail.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

### Model format

Always use `"provider/model-name"`:

- `"openai/gpt-4o"`
- `"anthropic/claude-3-5-sonnet-20241022"`
- `"google/gemini-2.5-pro"`

## When you see errors

**Type errors often mean your knowledge is outdated.**

**Common signs of outdated knowledge:**

- `Property X does not exist on type Y`
- `Cannot find module`
- `Type mismatch` errors
- Constructor parameter errors

**What to do:**

1. Check [`references/common-errors.md`](references/common-errors.md)
2. Verify current API in embedded docs
3. Don't assume the error is a user mistake - it might be your outdated knowledge

## Development workflow

**Always verify before writing code:**

1. **Check packages installed**

   ```bash
   ls node_modules/@mastra/
   ```

2. **Look up current API**
   - If installed → Use embedded docs [`references/embedded-docs.md`](references/embedded-docs.md)
   - If not → Use remote docs [`references/remote-docs.md`](references/remote-docs.md)

3. **Write code based on current docs**

4. **Test in Studio**
   ```bash
   npm run dev  # http://localhost:4111
   ```

## Resources

- **Setup**: [`references/create-mastra.md`](references/create-mastra.md)
- **Embedded docs lookup**: [`references/embedded-docs.md`](references/embedded-docs.md) - Start here if packages are installed
- **Remote docs lookup**: [`references/remote-docs.md`](references/remote-docs.md)
- **Common errors**: [`references/common-errors.md`](references/common-errors.md)
- **Migrations**: [`references/migration-guide.md`](references/migration-guide.md)
- **Official site**: https://mastra.ai (verify against embedded docs first)
