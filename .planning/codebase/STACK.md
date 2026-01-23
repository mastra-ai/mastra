# Technology Stack

**Analysis Date:** 2026-01-23

## Languages

**Primary:**
- TypeScript 5.9.3 - Entire codebase, strict mode enabled
- JavaScript - Node.js scripts and configuration files

**Secondary:**
- SQL - Database migrations and queries
- YAML - Docker Compose, configuration

## Runtime

**Environment:**
- Node.js (no specific version file, uses pnpm for consistency)

**Package Manager:**
- pnpm 10.18.2+ (enforced via preinstall script)
- Lockfile: pnpm-lock.yaml (v9.0)

## Frameworks

**Core Framework:**
- Hono 4.11.3 - Web framework for routing and HTTP handling
- Turbo 2.5.8 - Monorepo build orchestration

**AI/LLM Integration:**
- Vercel AI SDK - Multiple versions (v4, v5, v6) for language model abstraction
  - `@ai-sdk/openai` (v1.3.24 and v2.0.69 and v3.0.1)
  - `@ai-sdk/anthropic-v5` (v2.0.45)
  - `@ai-sdk/google-v5` (v2.0.40)
  - `@ai-sdk/deepseek-v5` (v1.0.31)
  - `@ai-sdk/mistral-v5` (v2.0.24)
  - `@ai-sdk/xai-v5` (v2.0.33)
  - `@ai-sdk/perplexity-v5` (v2.0.5)
  - `@ai-sdk/openai-compatible-v5` (v1.0.27) - For custom gateways
  - `@ai-sdk/azure` (v2.0.0)
  - `@openrouter/ai-sdk-provider-v5` (v1.2.3)

**Testing:**
- Vitest 4.0.16 - Test runner with TypeScript support
- @vitest/coverage-v8 4.0.12 - Coverage reporting
- @vitest/ui 4.0.12 - Visual test interface

**Build/Dev:**
- tsup 8.5.1 - TypeScript bundler for packages
- Rollup 4.55.2 - Module bundler for deployer and complex builds
- ESLint 9.39.2 - Linting
- Prettier 3.7.4 - Code formatting
- Vite 7.3.0 - Fast bundler (used in dev)

**Documentation:**
- Next.js (in docs/ directory) - Documentation site

## Key Dependencies

**Critical Infrastructure:**
- `@modelcontextprotocol/sdk` 1.17.5 - Model Context Protocol for tool integration
- `zod` 3.25.76 - Schema validation
- `hono-openapi` 1.1.1 - OpenAPI spec generation for Hono

**Utilities:**
- `js-tiktoken` 1.0.21 - Token counting for LLMs
- `lru-cache` 11.2.2 - Caching layer
- `p-retry` 7.1.0 - Retry logic with exponential backoff
- `p-map` 7.0.3 - Promise mapping utility
- `xxhash-wasm` 1.1.0 - Fast hashing for vector operations
- `radash` 12.1.1 - Utility library

**Development Dependencies:**
- `@types/node` 22.19.7 - Node.js type definitions
- `typescript` 5.9.3 - Bundled with strict config
- Husky 9.1.7 - Git hooks for quality checks
- lint-staged 16.1.6 - Run linters on staged files
- changesets 2.29.8 - Versioning and changelog management

## Configuration

**Environment:**
- Environment variables loaded from `.env` files (dotenv 17.2.3)
- Critical vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Turbo build env vars: `RAPID_API_KEY`, `ANTHROPIC_API_KEY`

**TypeScript Compiler Options:**
- Target: ES2020
- Module: ES2022
- Strict: true (all strict options enabled)
- No implicit returns, unused variables, or unused parameters
- Declaration and declarationMap enabled for all packages
- moduleResolution: Node with JSON module resolution
- Location: `tsconfig.json` (root) with per-package overrides

**Build Configuration:**
- Primary: `turbo.json` - Defines task dependencies and caching
- Per-package: `tsup` config for library builds, `rollup.config.ts` for complex builds
- ESLint: `eslint.config.js` (modern flat config format)
- Prettier: `.prettierrc` (printWidth: 120, semi: true, singleQuote: true, tabs: 2)

**Package Configuration:**
- Uses pnpm workspaces with `pnpm-lock.yaml`
- Resolutions enforce specific versions: cookie >=0.7.2, ssri >=6.0.2, jws ^4.0.1, jsondiffpatch >=0.7.3
- Overrides for test packages: zod v3 and v4 variants, better-auth ^1.4.5

## Platform Requirements

**Development:**
- Node.js (via pnpm 10.18.2+)
- Docker (required for integration tests via `.dev/docker-compose.yaml`)
- Services: PostgreSQL with pgvector 0.8.0, Qdrant vector DB, Redis

**Production:**
- Node.js runtime
- Pluggable storage: PostgreSQL, MongoDB, Elasticsearch, Pinecone, Chroma, DuckDB, ClickHouse, Cloudflare D1, Convex, Couchbase, Lance, LibSQL, MSSQL, OpenSearch, S3Vectors, Turbopuffer, Upstash, Astra, Vectorize
- Deployment targets: Vercel, Netlify, Cloudflare, generic Node.js hosting

---

*Stack analysis: 2026-01-23*
