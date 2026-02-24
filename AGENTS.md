# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Scope guidelines

**IMPORTANT**: Unless explicitly mentioned in the user's prompt, do NOT check, search, read, or reference files in the `examples/` folder. Only include examples when the user specifically asks about them.

## Monorepo structure

- This directory is a Git monorepo containing a `pnpm` workspace. pnpm is used for package management, and Turborepo is used for build orchestration.
- The monorepo spans multiple folders:
  - `@auth/`
  - `@client-sdks/`
  - `@deployers/`
  - `@docs/`
  - `@integrations/`
  - `@observability/`
  - `@packages/`
  - `@pubsub/`
  - `@server-adapters/`
  - `@stores/`
  - `@voice/`
  - `@workflows/`
  - `@workspaces/`
- The `@docs/` folder contains the documentation and needs specific instructions which are covered in `@docs/AGENTS.md`
- All packages use TypeScript with strict type checking
- Vitest is used for testing, with test files co-located with source code

## Development commands

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
- Core tests take a long time to run, for targeted changes, run the appropriate individual test suites.

### Linting and formatting

- `pnpm typecheck` - TypeScript checks across all packages
- `pnpm prettier:format` - Format code with Prettier
- `pnpm format` - Lint all packages with auto-fix (excludes examples, docs, playground)

## Documentation

The `@docs/` directory contains the source code and contents of the documentation site.

Whenever you change or add code, you MUST update/add related documentation for those changes. You always need to follow `@docs/styleguides/DOC.md` when writing documentation. The `@docs/styleguides/` folder also contains styleguides for specific types of documentation. Read `@docs/AGENTS.md` to learn more about how to work with documentation.

## Changelogs

After making changes to the codebase, you MUST create a changeset. Follow `@.claude/commands/changeset.md` for guidelines on how to create a changeset and write effective changelog messages.

## Architecture overview

Mastra is a modular AI framework built around central orchestration with pluggable components.

### Core components (`packages/core/src/`)

- **Mastra Class** (`mastra/`) - Central configuration hub with dependency injection
- **Agents** (`agent/`) - AI interaction abstraction with tools, memory, and voice
- **Tools** (`tools/`) - Dynamic tool composition from multiple sources (assigned, memory, toolsets, MCP)
- **Memory** (`memory/`) - Thread-based conversation persistence with semantic recall and working memory
- **Workflows** (`workflows/`) - Step-based execution with suspend/resume
- **Storage** (`storage/`) - Pluggable backends with standardized interfaces

### Key patterns

1. **Dependency Injection** - Components register with central Mastra instance
2. **Plugin Architecture** - Pluggable storage, vectors, memory, deployers
3. **Request Context** - Request-scoped context propagation for dynamic configuration
4. **Message List Abstraction** - Unified message handling across formats
