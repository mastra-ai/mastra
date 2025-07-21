# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Build

- `pnpm setup` - Install dependencies and build CLI (required first step)
- `pnpm build` - Build all packages (excludes examples and docs)
- `pnpm build:packages` - Build core packages only
- `pnpm build:core` - Build core framework package
- `pnpm build:cli` - Build CLI and playground package
- `pnpm build:memory` - Build memory package
- `pnpm build:rag` - Build RAG package
- `pnpm build:combined-stores` - Build all storage adapters
- `pnpm build:deployers` - Build deployment adapters
- `pnpm build:evals` - Build evaluation framework
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
- `pnpm test:watch` - Run tests in watch mode
- Package-specific tests: `pnpm test:core`, `pnpm test:cli`, `pnpm test:memory`, `pnpm test:rag`, etc.

### Development

- `pnpm dev:services:down` - Stop local Docker services
- `pnpm typecheck` - Run TypeScript checks across all packages
- `pnpm prettier:format` - Format code with Prettier
- `pnpm format` - Run linting across all packages with auto-fix (excludes examples, docs, integrations, playground)

## Documentation

### Documentation Locations

- **Main docs**: `docs/` directory - Contains the full documentation site built with Next.js
- **Course content**: `docs/src/course/` - Tutorial and learning materials
- **API reference**: Generated from code comments and exported types
- **Package READMEs**: Each package/integration has its own README.md
- **Development guide**: `DEVELOPMENT.md` - Setup and contribution instructions

### Documentation Guidelines

- Follow `.cursor/rules/writing-documentation.mdc` for writing style
- Avoid marketing language, focus on technical implementation details
- Examples should be practical and runnable

## Architecture Overview

Mastra is a modular AI framework built around central orchestration with pluggable components. Key architectural patterns:

### Core Components

- **Mastra Class** (`packages/core/src/mastra/`) - Central configuration hub with dependency injection
- **Agents** (`packages/core/src/agent/`) - Primary AI interaction abstraction with tools, memory, and voice
- **Tools System** (`packages/core/src/tools/`) - Dynamic tool composition supporting multiple sources
- **Memory System** (`packages/core/src/memory/`) - Thread-based conversation persistence with semantic recall
- **Workflows** (`packages/core/src/workflows/`) - Step-based execution with suspend/resume capabilities
- **Storage Layer** (`packages/core/src/storage/`) - Pluggable backends with standardized interfaces

### Package Structure

- **packages/** - Core framework packages (core, cli, deployer, rag, memory, evals, mcp, server)
- **stores/** - Storage adapters (pg, chroma, pinecone, etc.)
- **deployers/** - Platform deployment adapters (vercel, netlify, cloudflare)
- **speech/** - Speech processing packages (voice synthesis and recognition)
- **client-sdks/** - Client libraries for different platforms
- **integrations/** - Third-party API integrations (github, firecrawl, etc.)
- **examples/** - Demo applications
- **auth/** - Authentication provider integrations

### Key Patterns

1. **Dependency Injection** - Components register with central Mastra instance
2. **Plugin Architecture** - Pluggable storage, vectors, memory, deployers
3. **Runtime Context** - Request-scoped context propagation for dynamic configuration
4. **Message List Abstraction** - Unified message handling across formats

### Tools and Integrations

- Tools are dynamically composed from multiple sources (assigned, memory, toolsets, MCP)
- Integrations are OpenAPI-based with OAuth/API key authentication
- MCP (Model Context Protocol) enables external tool integration

### Storage and Memory

- Pluggable storage backends with standardized interfaces
- Memory system supports thread-based conversations, semantic recall, and working memory
- Vector stores provide semantic search capabilities

## Development Guidelines

### Documentation Writing

Follow `.cursor/rules/writing-documentation.mdc`:

- Avoid marketing language ("powerful", "complete", "out-of-the-box")
- Don't use "your needs", "production-ready", "makes it easy"
- Focus on technical details rather than benefits
- Write for engineers, not marketing

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
- Support both sync and async operations where applicable

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

