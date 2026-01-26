# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**

- TypeScript 5.9.3 - All packages, strict mode enabled
- JavaScript (ESM) - Configuration files

**Secondary:**

- JSON - Configuration, package manifests
- YAML - Docker Compose, pnpm workspace config

## Runtime

**Environment:**

- Node.js >= 22.13.0 (required across all packages)

**Package Manager:**

- pnpm 10.18.2 (enforced via `preinstall` check)
- Lockfile: `pnpm-lock.yaml` present (lockfileVersion 9.0)
- Workspace: `pnpm-workspace.yaml` defines monorepo structure

## Frameworks

**Core:**

- Hono 4.11.3 - HTTP server framework for API layer
- React >= 19.0.0 - Playground UI and client SDK

**Testing:**

- Vitest 4.0.16 - Unit and integration testing
- @vitest/coverage-v8 4.0.12 - Coverage reporting
- @vitest/ui 4.0.12 - Test UI

**Build/Dev:**

- Turborepo 2.5.8 - Monorepo build orchestration
- tsup 8.5.1 - TypeScript bundler for library packages
- Vite 7.3.0 - Build tool for UI packages
- Rollup 4.55.x - Used via deployer for bundling
- esbuild 0.25.10 - Fast TypeScript/JavaScript bundler

**UI:**

- Tailwind CSS 3.x - Styling for playground-ui
- Radix UI - Headless component primitives
- Storybook 9.1.x - Component development

## Key Dependencies

**AI/LLM:**

- @ai-sdk/provider-v5 (2.0.0) - AI SDK provider interface
- @ai-sdk/provider-v6 (3.0.0) - AI SDK v6 provider interface
- @modelcontextprotocol/sdk 1.17.5 - MCP protocol support
- Various AI SDK providers (@ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, etc.)

**Infrastructure:**

- dotenv 17.2.3 - Environment variable loading
- zod 3.25.x / 4.x - Schema validation (peer dependency)
- superjson 2.2.2 - JSON serialization with types
- lru-cache 11.2.2 - In-memory caching
- js-tiktoken 1.0.21 - Token counting

**Utilities:**

- radash 12.1.1 - Utility functions
- p-map 7.0.3 - Promise concurrency control
- p-retry 7.1.0 - Promise retry logic
- @lukeed/uuid 2.0.1 - UUID generation

## Configuration

**TypeScript:**

- `tsconfig.json` - Root config (ES2022 module, strict mode)
- `tsconfig.build.json` - Build-specific config
- Per-package `tsconfig.json` extends root

**Build:**

- `turbo.json` - Task dependencies and caching
- Package-level `tsup.config.ts` - Library bundling
- Package-level `vitest.config.ts` - Test configuration

**Environment:**

- `.env` files - Per-project environment configuration
- Common env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
- Model format: `provider/model-name` (e.g., `openai/gpt-4o-mini`)

**Linting/Formatting:**

- ESLint 9.x - Linting
- Prettier 3.6.x - Code formatting
- lint-staged 16.x - Pre-commit hooks
- Husky 9.1.x - Git hooks

## Platform Requirements

**Development:**

- Node.js >= 22.13.0
- pnpm >= 10.18.0
- Docker (for integration tests)

**Production:**

- Node.js >= 22.13.0
- Supports deployment to: Vercel, Netlify, Cloudflare Workers
- Docker containers supported via `.dev/docker-compose.yaml`

## Monorepo Structure

**Workspace Packages:**

- `packages/*` - Core framework packages
- `stores/*` - Storage/vector adapters (23 stores)
- `deployers/*` - Deployment adapters (4 deployers)
- `voice/*` - Speech/voice integrations (13 providers)
- `server-adapters/*` - HTTP framework adapters (4 adapters)
- `client-sdks/*` - Client libraries (3 SDKs)
- `auth/*` - Authentication integrations (6 providers)
- `observability/*` - Telemetry/tracing (11 providers)
- `pubsub/*` - Pub/sub integrations (1 provider)
- `integrations/*` - Third-party API integrations

**Build Commands:**

```bash
pnpm setup              # Install deps + build all
pnpm build              # Build all (excluding examples/docs)
pnpm build:core         # Build @mastra/core only
pnpm build:packages     # Build packages/* only
pnpm build:combined-stores  # Build stores/*
```

**Test Commands:**

```bash
pnpm dev:services:up    # Start Docker services
pnpm test               # Run all tests
pnpm test:core          # Run core package tests
```

---

_Stack analysis: 2026-01-26_
