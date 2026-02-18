# External Integrations

**Analysis Date:** 2026-01-27

## AI/LLM Providers

**OpenAI:**

- Package: `@ai-sdk/openai`, `@mastra/voice-openai`
- SDK: `openai ^5.11.0`
- Uses: Chat completion, embeddings, voice synthesis
- Auth: `OPENAI_API_KEY`

**Anthropic:**

- Package: `@ai-sdk/anthropic-v5`
- Uses: Claude models
- Auth: `ANTHROPIC_API_KEY`

**Google AI:**

- Package: `@ai-sdk/google-v5`
- Uses: Gemini models, embeddings
- Voice: `voice/google`, `voice/google-gemini-live-api`

**Azure OpenAI:**

- Package: `@ai-sdk/azure`
- Voice: `voice/azure`

**Other AI:**

- DeepSeek: `@ai-sdk/deepseek-v5`
- Mistral: `@ai-sdk/mistral-v5`
- xAI: `@ai-sdk/xai-v5`
- Perplexity: `@ai-sdk/perplexity-v5`
- OpenRouter: `@openrouter/ai-sdk-provider`

## Data Storage

**Databases:**

- PostgreSQL (primary): `stores/pg`
  - Client: `pg ^8.16.3`
  - Vector: pgvector 0.8.0+
  - Connection: `POSTGRES_*` env vars

**Vector Stores:**

- Pinecone: `stores/pinecone` - `@pinecone-database/pinecone ^3.0.3`
- Chroma: `stores/chroma`
- Qdrant: `stores/qdrant`
- Elasticsearch: `stores/elasticsearch`
- OpenSearch: `stores/opensearch`
- DynamoDB: `stores/dynamodb`
- MongoDB: `stores/mongodb`
- Cloudflare Vectorize: `stores/vectorize`
- Lance: `stores/lance`
- Turbopuffer: `stores/turbopuffer`
- Upstash: `stores/upstash`
- S3Vectors: `stores/s3vectors`
- Astra: `stores/astra`
- Couchbase: `stores/couchbase`
- Convex: `stores/convex`

**SQL Stores:**

- LibSQL/Turso: `stores/libsql`
- Cloudflare D1: `stores/cloudflare-d1`
- DuckDB: `stores/duckdb`
- MS SQL: `stores/mssql`
- ClickHouse: `stores/clickhouse`

**File Storage:**

- Local filesystem (default)

**Caching:**

- Redis (for development): `.dev/docker-compose.yaml`
- LRU Cache: `lru-cache ^11.2.2` (in-memory)

## Authentication & Identity

**Auth Providers (`auth/` directory):**

- **WorkOS:** `@mastra/auth-workos`
  - SDK: `@workos-inc/node ^8.0.0`, `@workos/authkit-session ^0.3.4`
  - Features: SSO, directory sync

- **Auth0:** `@mastra/auth-auth0`
  - SDK: `jose ^6.1.1` (JWT verification)
  - Pattern: JWKS validation

- **Supabase:** `@mastra/auth-supabase`
  - SDK: `@supabase/supabase-js ^2.50.3`

- **Better Auth:** `@mastra/auth-better-auth`
  - SDK: `better-auth ^1.4.5`
  - Self-hosted auth option

- **Firebase:** `@mastra/auth-firebase`
  - Firebase Auth integration

- **Cloud:** `auth/cloud`
  - Mastra Cloud auth

**Core Auth Package:**

- `packages/auth`
- JWT: `jsonwebtoken ^9.0.2`
- JWKS: `jwks-rsa ^3.2.0`

## Monitoring & Observability

**Tracing Providers (`observability/`):**

- Langfuse: `@mastra/langfuse` - `langfuse ^3.38.6`
- Langsmith: `@mastra/langsmith`
- Braintrust: `@mastra/braintrust`
- Arize: `@mastra/arize`
- Laminar: `@mastra/laminar`
- Sentry: `@mastra/sentry`
- Datadog: `@mastra/datadog`
- PostHog: `@mastra/posthog`

**OpenTelemetry:**

- `observability/otel-exporter`
- `observability/otel-bridge`

**Error Tracking:**

- Sentry integration available

**Logs:**

- `packages/loggers` - Logging abstraction
- pino (transitive dependency)

## CI/CD & Deployment

**Deployers (`deployers/`):**

- Vercel: `@mastra/deployer-vercel`
- Netlify: `@mastra/deployer-netlify`
- Cloudflare: `@mastra/deployer-cloudflare`
- Cloud: `@mastra/deployer-cloud`

**CI Pipeline:**

- GitHub Actions (`.github/` directory)
- Changesets for versioning

**Hosting:**

- Serverless platforms (Vercel, Netlify, Cloudflare)
- Self-hosted (any Node.js environment)

## HTTP Server Adapters

**Server Adapters (`server-adapters/`):**

- Hono: `@mastra/hono` (primary)
- Express: `@mastra/express`
- Fastify: `@mastra/fastify`
- Koa: `@mastra/koa`

## Voice & Speech

**Speech Providers (`voice/`):**

- OpenAI: `@mastra/voice-openai` - `openai ^5.11.0`
- OpenAI Realtime: `voice/openai-realtime-api`
- Deepgram: `voice/deepgram`
- ElevenLabs: `voice/elevenlabs`
- Google: `voice/google`
- Google Gemini Live: `voice/google-gemini-live-api`
- Azure: `voice/azure`
- Cloudflare: `voice/cloudflare`
- PlayAI: `voice/playai`
- Speechify: `voice/speechify`
- Murf: `voice/murf`
- Gladia: `voice/gladia`
- Sarvam: `voice/sarvam`

## Model Context Protocol (MCP)

**MCP Integration:**

- `packages/mcp`
- SDK: `@modelcontextprotocol/sdk ^1.17.5`
- Features: Tool integration, server/client

## Environment Configuration

**Required env vars (common):**

- `OPENAI_API_KEY` - OpenAI access
- `ANTHROPIC_API_KEY` - Anthropic access
- `POSTGRES_*` - Database connection
- Auth provider-specific keys

**Secrets location:**

- `.env` files (gitignored)
- Platform environment variables

## Webhooks & Callbacks

**Incoming:**

- MCP server endpoints
- Auth callback URLs (OAuth flows)
- A2A protocol endpoints

**Outgoing:**

- Observability provider webhooks
- Auth provider callbacks

---

_Integration audit: 2026-01-27_
