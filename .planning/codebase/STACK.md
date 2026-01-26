# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- TypeScript 5.9.3 - Core framework and all packages
- JavaScript ES2022+ - Build and scripting utilities

**Secondary:**
- JSON - Configuration and schema definitions
- Shell scripts - CLI commands and local development

## Runtime

**Environment:**
- Node.js 22.13.0+ (minimum version enforced in engines field across all packages)

**Package Manager:**
- pnpm 10.18.2+ (enforced via preinstall hook)
- Lockfile: pnpm-lock.yaml (present)

## Frameworks

**Core Framework:**
- Mastra Core `@mastra/core` 1.0.4 - AI orchestration framework with agents, tools, memory, workflows
- Hono 4.11.3 - HTTP web framework for routing and middleware (`packages/core`, `packages/server`, `server-adapters/hono`)

**CLI & Tooling:**
- Commander 14.0.2 - CLI command parsing in `packages/cli`
- Clack 0.11.0 - Interactive CLI prompts

**Build Tools:**
- Turbo 2.5.8 - Monorepo build orchestration (turbo.json configured)
- Rollup 4.55.1 - Module bundling for deployer package
- esbuild 0.25.10 - Fast JavaScript bundler
- tsup 8.5.1 - TypeScript module bundler (used across all packages)
- Vite 7.3.0 - Development server and build tool

**Testing:**
- Vitest 4.0.16 - Unit and integration test runner (vitest.config.ts configured)
- Vitest UI 4.0.12 - Test visualization dashboard
- Coverage Tool: @vitest/coverage-v8 4.0.12

**Code Quality:**
- ESLint 9.39.2 - Linting and static analysis
- Prettier 3.6.2 - Code formatting (.prettierrc configured with 120 char line width)
- TypeScript strict mode - Type checking (tsc --noEmit)

## Key Dependencies

**AI & LLM Integrations:**
- @ai-sdk/* family (v2.0+ and v3.0+ variants) - Vercel AI SDK for LLM providers
  - @ai-sdk/provider-v5 and v6 - Provider interfaces for multiple SDK versions
  - @ai-sdk/openai, @ai-sdk/anthropic-v5 - Model provider clients
  - @ai-sdk/google-v5, @ai-sdk/mistral-v5, @ai-sdk/deepseek-v5 - Additional model providers
  - @ai-sdk/openai-compatible-v5 - Compatible with OpenAI-style APIs
- js-tiktoken 1.0.21 - Token counting for LLMs

**Database & Storage:**
- pg 8.16.3 - PostgreSQL client (`stores/pg`)
- pgvector 0.8.0+ - PostgreSQL vector extension (Docker image pgvector/pgvector:0.8.0-pg16)
- @pinecone-database/pinecone 3.0.3 - Vector database (`stores/pinecone`)
- Multiple vector store adapters: Chroma, Qdrant, ElasticSearch, OpenSearch, Lance, Turbopuffer, Upstash, DuckDB, etc. (`stores/*`)

**Authentication:**
- better-auth 1.4.5 - Self-hosted auth solution (`auth/better-auth`)
- Auth0, Clerk, Firebase, Supabase, WorkOS integrations available (`auth/*`)

**Speech & Voice:**
- Multiple voice packages for TTS/STT: Azure, Google, Deepgram, ElevenLabs, OpenAI, Murf, etc. (`voice/*`)

**Observability & Monitoring:**
- @modelcontextprotocol/sdk 1.17.5 - Model Context Protocol support
- Observability integrations: Langsmith, Langfuse, Datadog, Arize, Braintrust, Sentry, PostHog, Laminar (`observability/*`)
- posthog-node 5.17.2 - Product analytics telemetry in CLI

**Utilities & Helpers:**
- zod 3.25.0+ or 4.0.0+ - Schema validation (peer dependency)
- radash 12.1.1 - Utility functions
- hono-openapi 1.1.1 - OpenAPI schema generation for Hono
- lru-cache 11.2.2 - In-memory caching
- async-mutex 0.5.0 - Async mutual exclusion locks
- xxhash-wasm 1.1.0 - Fast hashing
- p-map 7.0.3, p-retry 7.1.0 - Promise utilities
- dotenv 17.2.3 - Environment variable loading
- json-schema 0.4.0 - JSON Schema utilities
- node-html-better-parser 1.5.8 - HTML parsing
- fs-extra 11.3.3 - File system utilities
- shell-quote 1.8.3 - Shell argument quoting

**Server Adapters:**
- Express adapter - For Express.js integration
- Hono adapter - For Hono.js integration (`server-adapters/hono`)

## Configuration

**Environment:**
- `.env` files (dotenv for loading)
- Environment variables configured in turbo.json: `RAPID_API_KEY`, `ANTHROPIC_API_KEY`
- Docker services via docker-compose.yaml for PostgreSQL (pgvector), Qdrant, Redis

**Build:**
- TypeScript: `tsconfig.json` with strict mode, ES2020 target, ES2022 module
- Prettier: `.prettierrc` - 120 char line width, 2-space indentation, trailing commas, single quotes
- Vitest: `vitest.config.ts`, `vitest.config.observability.ts` for test configuration
- Turbo: `turbo.json` with build dependencies and caching configuration
- pnpm: `pnpm-workspace.yaml` defining package locations and catalog versions

**Monorepo Structure:**
- Managed with pnpm workspaces
- 25+ packages in `packages/*`
- 20+ vector store adapters in `stores/*`
- 4+ deployers in `deployers/*` (Vercel, Netlify, Cloudflare, Cloud)
- 6+ auth providers in `auth/*`
- 6+ server adapters in `server-adapters/*`
- 13+ voice providers in `voice/*`
- 13+ observability providers in `observability/*`

## Platform Requirements

**Development:**
- Node.js 22.13.0+
- pnpm 10.18.2+
- Docker (for services: PostgreSQL pgvector, Qdrant, Redis)
- Optional: Hono dev server, local HTTPS certificates via @expo/devcert

**Production:**
- Node.js 22.13.0+ runtime
- Cloud deployment: Vercel, Netlify, Cloudflare Workers, or generic cloud providers
- Database: PostgreSQL with pgvector, or alternative vector stores (Pinecone, Chroma, etc.)
- Auth: Integrated providers or self-hosted via Better Auth
- Voice: Optional external speech providers (Azure, Google, ElevenLabs, etc.)

---

*Stack analysis: 2026-01-26*
