# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**LLM Providers (via Vercel AI SDK):**
- OpenAI (GPT-4, GPT-4o, GPT-4 Mini, GPT-3.5)
  - SDK: `@ai-sdk/openai`, `@ai-sdk/openai-v5`, `@ai-sdk/openai-v6`
  - Auth: `OPENAI_API_KEY` environment variable
  - Used in: `packages/core`, evals, RAG

- Anthropic (Claude)
  - SDK: `@ai-sdk/anthropic-v5`
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Provider ID: `anthropic` in model router
  - Used in: Core agents, model routing (`packages/core/src/llm/model/router.ts`)

- Google (Gemini)
  - SDK: `@ai-sdk/google-v5`
  - Auth: Required API key
  - Used in: Core LLM routing

- DeepSeek
  - SDK: `@ai-sdk/deepseek-v5`
  - Used in: Model routing

- Mistral
  - SDK: `@ai-sdk/mistral-v5`
  - Used in: Model routing

- xAI (Grok)
  - SDK: `@ai-sdk/xai-v5`
  - Used in: Model routing

- Perplexity
  - SDK: `@ai-sdk/perplexity-v5`
  - Used in: Model routing

- Azure OpenAI
  - SDK: `@ai-sdk/azure` (v6)
  - Deployment support via gateways

- OpenAI-Compatible Providers
  - SDK: `@ai-sdk/openai-compatible-v5`
  - Supports custom OpenAI-compatible endpoints (e.g., Ollama, local LLMs)

- OpenRouter
  - SDK: `@openrouter/ai-sdk-provider`, `@openrouter/ai-sdk-provider-v5`
  - Multi-model access through single gateway

**Model Routing Gateways:**
- Netlify Gateway - Default gateway for model routing (`packages/core/src/llm/model/gateways/netlify.ts`)
- Models.dev Gateway - Provider registry for static model mappings
- Custom Gateway Support - User-defined gateways for private/custom models

**Speech & Voice Providers:**
- OpenAI (TTS/Realtime API)
  - Package: `voice/openai`, `voice/openai-realtime-api`
  - Auth: `OPENAI_API_KEY`

- ElevenLabs
  - Package: `voice/elevenlabs`
  - Auth: API key required
  - Features: TTS, voice cloning

- Azure Speech
  - Package: `voice/azure`
  - Auth: Azure credentials

- DeepGram (Speech Recognition)
  - Package: `voice/deepgram`
  - Auth: API key required

- Google (TTS/Speech)
  - Package: `voice/google`, `voice/google-gemini-live-api`
  - Auth: Google API credentials

- Play.ai
  - Package: `voice/playai`
  - Auth: API key required

- Sarvam (Indian language support)
  - Package: `voice/sarvam`

- Murf AI (Voice synthesis)
  - Package: `voice/murf`

- Speechify (TTS)
  - Package: `voice/speechify`

- Gladia (Speech-to-text)
  - Package: `voice/gladia`

## Data Storage

**Databases:**
- PostgreSQL
  - Client: `pg` 8.16.3 (node-postgres)
  - Connection: Environment-configured connection string
  - Usage: Vector storage and relational data in `stores/pg`
  - Features: Vector search, semantic recall, message persistence

**Vector Stores (Pluggable):**
- Pinecone - `stores/pinecone`
- Chroma - `stores/chroma`
- Astra DB (DataStax) - `stores/astra`
- Cloudflare Vectorize - `stores/cloudflare`
- Qdrant - `stores/qdrant`
- DuckDB - `stores/duckdb`
- MongoDB - `stores/mongodb`
- Elasticsearch - `stores/elasticsearch`
- OpenSearch - `stores/opensearch`
- LibSQL (Turso) - `stores/libsql`
- Convex - `stores/convex`
- Couchbase - `stores/couchbase`
- Milvus - `stores/lance` (Lance integration)
- ClickHouse - `stores/clickhouse`
- AWS DynamoDB - `stores/dynamodb`
- Cloudflare D1 - `stores/cloudflare-d1`
- Microsoft SQL Server - `stores/mssql`
- Lance (vector database) - `stores/lance`

**File Storage:**
- Local filesystem - For document processing in RAG (`packages/rag`)
- Firecrawl integration - `@mendable/firecrawl-js` for web scraping/crawling
- S3 Vector Store integration - `stores/s3vectors`

**Caching:**
- LRU Cache - In-memory via `lru-cache` 11.2.2 (`packages/memory`)
- TTL Cache - Token-based via `@isaacs/ttlcache` 2.1.4

## Authentication & Identity

**Auth Providers (in `auth/` directory):**
- Auth0 - `auth/auth0`
- Clerk - `auth/clerk`
- Firebase - `auth/firebase`
- Supabase - `auth/supabase`
- WorkOS - `auth/workos`
- Better-Auth - `packages/auth` (integrated auth solution)

**OAuth/API Key Auth:**
- Environment variable-based API key authentication for all LLM providers
- Bearer token support for custom gateways
- Header-based authentication for OpenAI-compatible endpoints

## Monitoring & Observability

**Error Tracking & Analytics:**
- PostHog - Analytics and error tracking
  - Package: `posthog-node` 5.17.2 (backend), `posthog-js` 1.281.0, `@posthog/react` 1.5.2 (frontend)
  - Used in: CLI (`packages/cli`), Playground (`packages/playground`)
  - Integration: Telemetry throughout framework

**OpenTelemetry Integrations (in `observability/` directory):**
- Datadog - `observability/datadog`
- Langsmith - `observability/langsmith` (LangChain observability)
- Langfuse - `observability/langfuse` (LLM observability)
- Sentry - `observability/sentry` (Error tracking)
- Arize - `observability/arize` (ML monitoring)
- Braintrust - `observability/braintrust` (LLM testing/evaluation)
- Laminar - `observability/laminar` (AI observability)
- Mastra Cloud Observability - `observability/mastra` (First-party observability)
- OpenTelemetry Bridge - `observability/otel-bridge`
- OpenTelemetry Exporter - `observability/otel-exporter`

**Logging:**
- Console-based by default
- Structured logging via PostHog
- Package: `@mastra/loggers` for centralized logging

## CI/CD & Deployment

**Hosting Platforms:**
- Vercel - `deployers/vercel` with optimized asset handling
- Netlify - `deployers/netlify` (gateway support)
- Cloudflare Workers - `deployers/cloudflare`
- Generic Cloud Deployment - `deployers/cloud`

**Server Adapters (Pluggable Web Frameworks):**
- Express - `server-adapters/express`
- Fastify - `server-adapters/fastify`
- Hono - `server-adapters/hono` (default in core)
- Koa - `server-adapters/koa`

**CI Configuration:**
- Not detected in monorepo root (likely GitHub Actions via workflow files)

## Environment Configuration

**Required Environment Variables:**
- `MODEL` - Primary LLM model ID (e.g., `openai/gpt-4o-mini`)
- `OPENAI_API_KEY` - OpenAI API authentication
- `ANTHROPIC_API_KEY` - Anthropic API authentication
- Provider-specific keys for selected LLM provider
- Database connection strings for selected vector store
- Third-party integration keys (speech, auth, etc.) as needed

**Configuration Methods:**
- `.env` files loaded via `dotenv` 17.2.3
- Environment variable precedence: process.env > .env > defaults
- CLI integration supports dynamic provider selection

**Secrets Location:**
- Environment variables (production)
- `.env` files (local development, not committed)
- Configuration objects in code (testing with mocks)

## External Tool Integration

**Model Context Protocol (MCP):**
- Package: `@modelcontextprotocol/sdk` 1.17.5
- Enabled in: `packages/mcp` (MCP server and client implementations)
- Transport: HTTP with SSE support (`hono-mcp-server-sse-transport`)
- Use Case: Dynamic external tool/resource integration

**Firecrawl Integration:**
- Package: `@mendable/firecrawl-js` 1.29.3
- Used in: MCP docs server, web scraping for RAG
- Purpose: Web page crawling and document extraction

**Web Framework Integrations:**
- Hono 4.11.3 - HTTP server framework for request/response handling
- hono-openapi 1.1.1 - OpenAPI specification generation

## Webhooks & Callbacks

**Incoming:**
- Server request handlers in `packages/server/src/server/handlers/`
- Webhook-based tool call execution support
- Model Context Protocol SSE transport for callbacks

**Outgoing:**
- Agent callback system for tool execution
- Workflow event callbacks via `packages/core/src/workflows/`
- Request context propagation for dynamic callbacks

## A2A (Agent-to-Agent) Communication

**A2A SDK:**
- Package: `@a2a-js/sdk` 0.2.4
- A2A store support in `packages/server/server/a2a/store.ts`
- Enables agent composition and inter-agent communication

---

*Integration audit: 2026-01-27*
