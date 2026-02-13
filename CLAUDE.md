# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope Guidelines

**IMPORTANT**: Unless explicitly mentioned in the user's prompt, do NOT check, search, read, or reference files in the `examples/` folder. Only include examples when the user specifically asks about them.

## Development Commands

### Build

- `pnpm run setup` - Install dependencies and build all packages (required first step)
- `pnpm build` - Build all packages (excludes examples and docs)
- `pnpm build:packages` - Build only `packages/` directory
- `pnpm build:core`, `pnpm build:memory`, `pnpm build:rag`, `pnpm build:evals` - Build individual packages
- `pnpm build:cli` - Build CLI package
- `pnpm build:combined-stores` - Build all storage adapters
- `pnpm build:deployers` - Build deployment adapters

### Testing

- `pnpm dev:services:up` / `pnpm dev:services:down` - Start/stop Docker services (required for integration tests)
- Integration test folders and `/examples` folders need to run `pnpm i --ignore-workspace`
- Package-specific tests: `pnpm test:core`, `pnpm test:cli`, `pnpm test:memory`, `pnpm test:rag`, etc.
- For faster iteration: build from root first, then `cd` into a package and run `pnpm test` there
- Core tests take a long time to run, for targetted changes, run the appropriate individual test suites.

### Linting and Formatting

- `pnpm typecheck` - TypeScript checks across all packages
- `pnpm prettier:format` - Format code with Prettier
- `pnpm format` - Lint all packages with auto-fix (excludes examples, docs, playground)

## Architecture Overview

Mastra is a modular AI framework built around central orchestration with pluggable components.

### Core Components (`packages/core/src/`)

- **Mastra Class** (`mastra/`) - Central configuration hub with dependency injection
- **Agents** (`agent/`) - AI interaction abstraction with tools, memory, and voice
- **Tools** (`tools/`) - Dynamic tool composition from multiple sources (assigned, memory, toolsets, MCP)
- **Memory** (`memory/`) - Thread-based conversation persistence with semantic recall and working memory
- **Workflows** (`workflows/`) - Step-based execution with suspend/resume
- **Storage** (`storage/`) - Pluggable backends with standardized interfaces

### Repository Structure

- **packages/** - Core framework (core, cli, server, deployer, rag, memory, evals, mcp, mcp-docs-server, auth, agent-builder, create-mastra, playground, playground-ui, schema-compat, fastembed, loggers, codemod)
- **stores/** - Storage and vector adapters (pg, chroma, pinecone, libsql, mongodb, qdrant, etc.)
- **deployers/** - Platform deployment adapters (vercel, netlify, cloudflare, cloud)
- **server-adapters/** - Server framework adapters (hono, express)
- **voice/** - Voice synthesis and recognition packages
- **client-sdks/** - Client libraries (ai-sdk, client-js, react)
- **auth/** - Authentication providers (auth0, better-auth, clerk, firebase, supabase, workos)
- **observability/** - Observability integrations
- **communications/** - Communication channel packages
- **pubsub/** - Pub/sub packages
- **workflows/** - Workflow packages
- **examples/** - Demo applications
- **e2e-tests/** - End-to-end test suites
- **templates/** - Project templates

### Key Patterns

1. **Dependency Injection** - Components register with central Mastra instance
2. **Plugin Architecture** - Pluggable storage, vectors, memory, deployers
3. **Request Context** - Request-scoped context propagation for dynamic configuration
4. **Message List Abstraction** - Unified message handling across formats

## Development Guidelines

### Documentation

- Main docs in `docs/`, course content in `docs/src/course/`, dev guide in `DEVELOPMENT.md`
- Follow `.cursor/rules/writing-documentation.mdc` for writing style: avoid marketing language ("powerful", "production-ready", "makes it easy"), focus on technical details, write for engineers

### Changesets

Changelogs are authored via changesets in `.changeset/`. Follow `.claude/commands/changeset.md` for guidelines.

### Monorepo

- pnpm (v10.18.0+) for package management, Turborepo for build orchestration
- All packages use TypeScript with strict type checking
- Vitest for testing, test files co-located with source code

