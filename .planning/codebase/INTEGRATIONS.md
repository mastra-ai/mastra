# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**LLM Providers:**
- OpenAI - Text and embedding models via `@ai-sdk/openai` and `@ai-sdk/openai-v5`
  - SDK: Vercel AI SDK (@ai-sdk/openai)
  - Auth: `OPENAI_API_KEY` environment variable
- Anthropic - Claude models via `@ai-sdk/anthropic-v5`
  - SDK: Vercel AI SDK
  - Auth: `ANTHROPIC_API_KEY` (referenced in turbo.json)
- Google - Gemini models via `@ai-sdk/google-v5`
- Mistral - Models via `@ai-sdk/mistral-v5`
- DeepSeek - Models via `@ai-sdk/deepseek-v5`
- XAI - Grok models via `@ai-sdk/xai-v5`
- Perplexity - Models via `@ai-sdk/perplexity-v5`
- OpenRouter - Multi-model router via `@openrouter/ai-sdk-provider-v5`
- Azure - Azure OpenAI via `@ai-sdk/azure`
- Cohere - Text generation via `@ai-sdk/cohere`
- OpenAI-compatible - Generic OpenAI-compatible APIs via `@ai-sdk/openai-compatible-v5`

**AI Gateways:**
- Netlify AI gateway - Custom provider support in `packages/core/src/llm/model/gateways/netlify.ts`
- Models.dev gateway - Custom provider support

**Speech & Voice:**
- Azure Speech - TTS/STT via `voice/azure`
- Google Cloud Speech - TTS/STT via `voice/google`
- OpenAI Realtime API - Voice interactions via `voice/openai-realtime-api`
- ElevenLabs - TTS service via `voice/elevenlabs`
- Deepgram - Speech-to-text via `voice/deepgram`
- Gladia - Speech processing via `voice/gladia`
- PlayAI - Voice synthesis via `voice/playai`
- Sarvam - Voice processing via `voice/sarvam`
- Murf - TTS service via `voice/murf`
- Speechify - TTS service via `voice/speechify`
- Google Gemini Live API - Realtime voice via `voice/google-gemini-live-api`
- Cloudflare - Voice services via `voice/cloudflare`

**Observability & Analytics:**
- Langsmith - LLM observability via `observability/langsmith`
  - Type: Observability platform
  - Integration: Tracing and evaluation
- Langfuse - Open-source observability via `observability/langfuse`
- Datadog - Infrastructure monitoring via `observability/datadog`
- Arize - ML monitoring via `observability/arize`
- Braintrust - LLM evaluation via `observability/braintrust`
- Sentry - Error tracking via `observability/sentry`
- PostHog - Product analytics via `observability/posthog`
  - SDK: posthog-node 5.17.2
  - Used in CLI for telemetry
- Laminar - LLM tracing via `observability/laminar`

**Web Scraping & Document Processing:**
- Firecrawl - Web scraping via `@mendable/firecrawl-js` 1.29.3 (used in MCP integration tests)

## Data Storage

**Databases:**
- PostgreSQL 16+ with pgvector extension
  - Connection: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` environment variables
  - Port: 5432 (Docker)
  - Client: pg 8.16.3
  - Vector store: `@mastra/pg` (includes both vector and database capabilities)

**Vector Stores:**
- Pinecone - Cloud vector database via `@mastra/pinecone` 1.0.0
  - SDK: @pinecone-database/pinecone 3.0.3
  - Auth: `PINECONE_API_KEY` environment variable
- Chroma - Open-source vector store via `@mastra/chroma`
- Qdrant - Vector database via `@mastra/qdrant`
  - Docker: qdrant/qdrant:latest on port 6333
- ElasticSearch - Search engine via `@mastra/elasticsearch`
- OpenSearch - OpenSearch alternative via `@mastra/opensearch`
- Lance - Embedded vector search via `@mastra/lance`
- Turbopuffer - Vector database via `@mastra/turbopuffer`
- Upstash - Serverless vector database via `@mastra/upstash`
- DuckDB - Embedded analytics via `@mastra/duckdb`
- LibSQL - SQLite-compatible via `@mastra/libsql`
- Cloudflare D1 - Workers database via `@mastra/cloudflare-d1`
- MongoDB - Document database via `@mastra/mongodb`
- Astra (DataStax) - Vector database via `@mastra/astra`
- Convex - Backend platform via `@mastra/convex`
- Couchbase - Document database via `@mastra/couchbase`
- ClickHouse - Analytic database via `@mastra/clickhouse`
- DynamoDB - AWS database via `@mastra/dynamodb`
- MSSQL - Microsoft SQL Server via `@mastra/mssql`
- S3Vectors - Vector database on S3 via `@mastra/s3vectors`

**Caching:**
- Redis - In-memory cache
  - Docker: redis:latest on port 6379 (docker-compose.yaml)
  - Volume: redis_data:/data
  - Used for session and temporary data storage

**File Storage:**
- S3-compatible storage - For document and model storage
- Cloud provider integrations - Vercel, Netlify, Cloudflare for file hosting

## Authentication & Identity

**Auth Providers:**
- Better Auth - Self-hosted open-source auth via `@mastra/auth-better-auth` 1.0.0
  - SDK: better-auth 1.4.5
  - Type: Self-hosted authentication
  - Supported: Multiple providers (OAuth, email/password, social)
- Auth0 - Enterprise auth via `auth/auth0`
- Clerk - User management via `auth/clerk`
- Firebase - Google's auth platform via `auth/firebase`
- Supabase - Open-source Firebase alternative via `auth/supabase`
- WorkOS - SSO platform via `auth/workos`

**Implementation:**
- Auth layer integrated in `@mastra/server` via `./server/auth` export
- Standard OAuth/API key authentication patterns across integrations

## Monitoring & Observability

**Error Tracking:**
- Sentry - Exception monitoring via `observability/sentry`
- Built-in telemetry framework in core package

**Logs:**
- Structured logging support
- Observability providers handle log aggregation
- CLI uses PostHog for analytics collection

**Tracing:**
- OpenTelemetry (OTEL) bridge via `observability/otel-bridge`
- OTEL exporter via `observability/otel-exporter`
- Custom trace scoring via `packages/core/src/evals/scoreTraces/`

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js and Node deployment via `deployers/vercel`
- Netlify - Edge functions and static hosting via `deployers/netlify`
- Cloudflare - Workers and edge computing via `deployers/cloudflare`
- Cloud - Generic cloud deployment via `deployers/cloud`
- Server adapters support: Hono (via `server-adapters/hono`), Express (via peer dependency)

**CI Pipeline:**
- GitHub Actions configured (`.github/` directory present)
- Turbo for incremental builds and caching

**Build & Bundling:**
- Rollup for library bundling
- esbuild for fast compilation
- Custom bundler in deployer package (`packages/deployer/src/bundler/`)

## Environment Configuration

**Required Environment Variables:**
- `OPENAI_API_KEY` - OpenAI API access
- `ANTHROPIC_API_KEY` - Anthropic API access (required for turbo build)
- `POSTGRES_USER` - PostgreSQL username (default: postgres)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: postgres)
- `POSTGRES_DB` - PostgreSQL database name (default: mastra)
- `RAPID_API_KEY` - RapidAPI key (required for turbo build)
- Provider-specific keys for LLM, voice, and observability services

**Database Connection:**
- Localhost development: PostgreSQL on 5432, Qdrant on 6333, Redis on 6379
- Cloud production: Environment-specific connection strings

**Secrets Location:**
- Environment variables: .env files (not committed)
- Managed by deployment platform (Vercel env vars, Cloudflare secrets, etc.)
- Docker compose for local development services

## Webhooks & Callbacks

**Incoming:**
- Agent execution endpoints - POST handlers for agent invocation
- Tool callback URLs - For webhook-triggered tools
- Authentication callbacks - From OAuth providers (Auth0, Clerk, etc.)
- Observability webhooks - From monitoring platforms

**Outgoing:**
- Model Context Protocol (MCP) - Tool integration standard via `@modelcontextprotocol/sdk` 1.17.5
- Custom tool callbacks - Agent-defined webhook endpoints
- Observability exports - To Langsmith, Langfuse, Datadog, etc.
- AI Gateway hooks - To Netlify and Models.dev gateways

## Integration Patterns

**Tool Integration:**
- OpenAPI-based tool definitions
- Dynamic tool composition from multiple sources: assigned tools, memory tools, toolsets, and MCP
- Tool builder framework in `packages/core/src/tools/tool-builder/`

**Provider System:**
- Pluggable LLM providers via Vercel AI SDK
- Custom gateway support for routing between providers
- Model router in `packages/core/src/llm/model/router.ts`

**Storage Layer:**
- Standardized interfaces for vector stores and databases
- Pluggable backend architecture
- Test utilities for storage provider testing in `stores/_test-utils`

**Memory System:**
- Thread-based conversation memory
- Semantic recall via vector search
- Working memory for in-context information

---

*Integration audit: 2026-01-26*
