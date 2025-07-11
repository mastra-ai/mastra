# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Build
- `pnpm setup` - Install dependencies and build CLI (required first step)
- `pnpm build` - Build all packages (excludes examples and docs)
- `pnpm build:packages` - Build core packages only
- `pnpm build:core` - Build core framework package
- `pnpm build:cli` - Build CLI and playground package
- `NODE_OPTIONS="--max-old-space-size=4096" pnpm build` - Build with increased memory if needed

### Testing
- `pnpm dev:services:up` - Start local Docker services (required for integration tests)
- For faster testing: Build from root, then cd to specific package and run tests there
  ```bash
  pnpm build  # Build from monorepo root first
  cd packages/memory
  pnpm test   # Much faster than running all tests
  ```
- `pnpm test` - Run all tests (slow, use sparingly)
- `pnpm typecheck` - Run TypeScript checks across all packages

## Architecture Overview

Mastra is a modular AI framework built around central orchestration with pluggable components.

### Core Components
- **Mastra Class** (`packages/core/src/mastra/`) - Central configuration hub with dependency injection
- **Agents** (`packages/core/src/agent/`) - Primary AI interaction abstraction with tools, memory, and voice
- **Tools System** (`packages/core/src/tools/`) - Dynamic tool composition supporting multiple sources
- **Memory System** (`packages/core/src/memory/`) - Thread-based conversation persistence with semantic recall
- **Workflows** (`packages/core/src/workflows/`) - Step-based execution with suspend/resume capabilities
- **Storage Layer** (`packages/core/src/storage/`) - Pluggable backends with standardized interfaces

### Package Structure
- **packages/** - Core framework packages (core, cli, deployer, rag, memory, evals, mcp)
- **stores/** - Storage adapters (pg, chroma, pinecone, etc.)
- **deployers/** - Platform deployment adapters (vercel, netlify, cloudflare)
- **integrations/** - Third-party API integrations (github, firecrawl, etc.)
- **examples/** - Demo applications

## Development Guidelines

### Monorepo Management
- Use pnpm (v9.7.0+) for package management
- Build dependencies are managed through turbo.json
- All packages use TypeScript with strict type checking
- For testing: build from root first, then cd to specific package for faster iteration

### Component Development
- Components should integrate with central Mastra orchestration
- Follow plugin patterns for extensibility
- Implement standardized interfaces for storage/vector operations
- Use telemetry decorators for observability

### Testing Strategy
- Integration tests require Docker services (`pnpm dev:services:up`)
- Use Vitest for testing framework
- Test files should be co-located with source code
- For faster development: build from root, then test individual packages
- Mock external services in unit tests

### Common Issues
- Memory errors during build: Use `NODE_OPTIONS="--max-old-space-size=4096"`
- Missing dependencies: Run `pnpm setup` first
- Test failures: Ensure Docker services are running and build from root first
- Type errors: Run `pnpm typecheck` to check all packages

## Documentation Guidelines

- Follow `.cursor/rules/writing-documentation.mdc` for writing style
- Avoid marketing language, focus on technical implementation details
- Examples should be practical and runnable

---

## Zod v3/v4 Dual Support (Production Ready)

**Peer Dependencies**: `"zod": "^3.25.0 || ^4.0.0 <5.0.0"` - supports both versions simultaneously.

**Key Utilities** in `packages/schema-compat/src/utils.ts`:
- `safeToJSONSchema()` - Runtime version detection: v4 native → v3 library fallback
- `safeValidate()` - Corruption-resistant validation with graceful fallbacks  
- `safeGetSchemaProperty()` - Cross-version property access (`_zod.def` vs `_def`)

**Usage**: 
- Version detection: `"_zod" in schema` (official pattern)
- Schema conversion: Automatic v4/v3 fallback chain
- Always use utilities instead of direct Zod calls for compatibility