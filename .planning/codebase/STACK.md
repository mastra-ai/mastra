# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code, strict mode enabled across monorepo
- JavaScript (Node.js) - Configuration and build scripts

**Secondary:**
- JSX/TSX - React component definitions in playground and UI packages

## Runtime

**Environment:**
- Node.js 22.13.0+ - Required minimum version across all packages

**Package Manager:**
- pnpm 10.18.0+ - Monorepo package manager with workspace support
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Hono 4.11.3 - HTTP server framework used in core and server packages (`packages/core`, `packages/server`)

**Frontend/UI:**
- React - Used in playground and client SDKs (`packages/playground`, `packages/playground-ui`, `client-sdks/react`)
- React Router - Client-side routing in playground (`packages/playground`)
- Vite 7.3.0 - Build tool for frontend packages

**Testing:**
- Vitest 4.0.16 - Test runner with coverage support (`@vitest/coverage-v8`, `@vitest/ui`)
- Vitest 4.0.12 - UI test runner (referenced in catalog)

**Build/Dev:**
- Turbo 2.5.8 - Monorepo build orchestration
- tsup 8.5.1 - TypeScript bundler used across packages
- Rollup 4.55.2 - Module bundler for various packages
- Prettier 3.6.2 - Code formatting (project-wide)
- ESLint 9.39.2 - Linting across monorepo

## Key Dependencies

**AI/LLM Integration (Vercel AI SDK):**
- `@ai-sdk/provider-v5` 2.0.0 - AI SDK v5 provider interface
- `@ai-sdk/provider-v6` 3.0.0 - AI SDK v6 provider interface
- `@ai-sdk/provider-utils-v5` 3.0.12 - Provider utilities for v5
- `@ai-sdk/provider-utils-v6` 4.0.0 - Provider utilities for v6
- `@ai-sdk/ui-utils-v5` 1.2.11 - UI utilities for v5
- `@ai-sdk/anthropic-v5` 2.0.45 - Anthropic Claude integration (v5)
- `@ai-sdk/openai` 1.3.24 - OpenAI integration (latest)
- `@ai-sdk/openai-v5` 2.0.69 - OpenAI integration (v5)
- `@ai-sdk/openai-v6` 3.0.1 - OpenAI integration (v6)
- `@ai-sdk/google-v5` 2.0.40 - Google Gemini integration (v5)
- `@ai-sdk/deepseek-v5` 1.0.31 - DeepSeek integration (v5)
- `@ai-sdk/mistral-v5` 2.0.24 - Mistral integration (v5)
- `@ai-sdk/xai-v5` 2.0.33 - xAI integration (v5)
- `@ai-sdk/perplexity-v5` 2.0.5 - Perplexity integration (v5)
- `@ai-sdk/openai-compatible-v5` 1.0.27 - Generic OpenAI-compatible provider
- `@ai-sdk/azure` 2.0.0 - Azure integration (v6)
- `@openrouter/ai-sdk-provider` 0.4.6 - OpenRouter integration

**MCP (Model Context Protocol):**
- `@modelcontextprotocol/sdk` 1.17.5 - MCP SDK for tool integration (`packages/mcp`)
- `hono-mcp-server-sse-transport` 0.0.7 - MCP SSE transport for Hono

**Storage & Databases:**
- PostgreSQL via `pg` 8.16.3 - `stores/pg` package for vector and relational storage
- Vector store integrations: Pinecone, Chroma, Astra DB, Cloudflare Vectorize, Qdrant, DuckDB, MongoDB, Elasticsearch, OpenSearch, LibSQL, Convex, Couchbase, Milvus, Lance, ClickHouse, DynamoDB, CloudFlare D1, MSSQL

**Memory & Caching:**
- `lru-cache` 11.2.2 - In-memory LRU cache for message windows (`packages/memory`)
- `@isaacs/ttlcache` 2.1.4 - TTL cache for token-based operations

**Utilities:**
- `dotenv` 17.2.3 - Environment variable loading
- `zod` 3.25.0+ or 4.0.0+ - Schema validation (peer dependency)
- `radash` 12.1.1 - Utility library
- `p-map` 7.0.3 - Parallel promise mapping
- `p-retry` 7.1.0 - Promise retry logic
- `js-tiktoken` 1.0.21 - OpenAI token counting
- `@lukeed/uuid` 2.0.1 - UUID generation
- `@sindresorhus/slugify` 2.2.1 - URL slug generation
- `xxhash-wasm` 1.1.0 - Fast hashing
- `fast-deep-equal` 3.1.3 - Deep equality checking
- `globby` 14.1.0 - Glob file matching

**Observability:**
- `posthog-node` 5.17.2 - PostHog analytics (CLI, playground)
- `@posthog/react` 1.5.2 - PostHog React integration (playground)
- `posthog-js` 1.281.0 - PostHog browser SDK (playground)
- OpenTelemetry integration packages in `observability/*` (Datadog, Laminar, Langfuse, Langsmith, Sentry, Arize, Braintrust)

**CLI & Dev Tools:**
- `commander` 14.0.2 - CLI argument parsing
- `@clack/prompts` 0.11.0 - Interactive prompts
- `execa` 9.6.1 - Process execution
- `picocolors` 1.1.1 - Terminal colors
- `yocto-spinner` 1.0.0 - Terminal spinners
- `fs-extra` 11.3.3 - Enhanced fs utilities
- `get-port` 7.1.0 - Find available ports
- `serve` 14.2.5 - Static server
- `shell-quote` 1.8.3 - Shell argument quoting

**Voice/Speech:**
- Multiple speech provider packages: `elevenlabs`, `openai`, `azure`, `deepgram`, `gladia`, `google`, `google-gemini-live-api`, `murf`, `playai`, `sarvam`, `speechify` (in `voice/` directory)

**Deployment:**
- Vercel, Netlify, Cloudflare deployer packages (`deployers/`)

**Server Adapters:**
- Express, Fastify, Hono, Koa (`server-adapters/`)

**Document Processing:**
- `node-html-better-parser` 1.5.8 - HTML parsing for RAG
- `@mendable/firecrawl-js` 1.29.3 - Web scraping/crawling
- `node-forge` 1.3.2 - Cryptographic operations

**NLP/ML:**
- `compromise` 14.14.4 - Natural language processing (evals)
- `sentiment` 5.0.2 - Sentiment analysis (evals)
- `string-similarity` 4.0.4 - String similarity matching (evals)
- `keyword-extractor` 0.0.28 - Keyword extraction (evals)
- `big.js` 7.0.1 - Arbitrary-precision arithmetic

**Schema & Type Generation:**
- `ts-morph` 27.0.2 - TypeScript AST manipulation
- `zod-to-json-schema` 3.24.6 - Zod to JSON Schema conversion
- `zod-from-json-schema` 0.5.0 - JSON Schema to Zod conversion
- `@apidevtools/json-schema-ref-parser` 14.2.1 - JSON Schema $ref resolution

## Configuration

**Environment:**
- Configuration via `.env` files (example: `.env.example` with `MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- `dotenv` package loads environment variables at runtime
- Support for multiple LLM providers via environment variables

**Build:**
- `tsconfig.json` - TypeScript configuration at monorepo root
- `tsconfig.build.json` - Build-specific TypeScript config
- `turbo.json` - Turbo build orchestration config
- `vite.config.ts` - Vite configuration for frontend packages
- `vitest.config.ts` - Vitest test runner configuration
- `.eslintrc` - ESLint configuration (v9.39.2+)
- `.prettierrc` - Prettier code formatting config
- `pnpm-workspace.yaml` - pnpm workspace configuration

**Special Configurations:**
- `tsconfig.zod-compat.json` - Zod v3/v4 compatibility testing
- `vitest.perf.config.ts` - Performance testing configuration (stores/pg)
- `docker-compose.yaml` - Local development services (PostgreSQL, Redis, etc.)

## Platform Requirements

**Development:**
- Node.js 22.13.0 or higher
- pnpm 10.18.0 or higher
- Docker (for integration tests requiring services like PostgreSQL)
- macOS, Linux, or Windows with appropriate tooling

**Production:**
- Node.js 22.13.0+ for deployment
- Supports deployment to: Vercel, Netlify, Cloudflare, custom servers
- Serverless-compatible (functions-as-a-service)

---

*Stack analysis: 2026-01-27*
