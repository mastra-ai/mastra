# External Integrations

**Analysis Date:** 2026-01-23

## APIs & External Services

**Large Language Model Providers:**
- OpenAI - Chat/completion and embedding models
  - SDK: `@ai-sdk/openai` (multiple versions v1.3.24, v2.0.69, v3.0.1)
  - Auth: `OPENAI_API_KEY` environment variable
  - Usage: Core LLM routing in `packages/core/src/llm/model/`

- Anthropic - Claude models
  - SDK: `@ai-sdk/anthropic-v5` (v2.0.45)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Usage: Via AI SDK v5 provider wrapper

- Google - Gemini models
  - SDK: `@ai-sdk/google-v5` (v2.0.40)
  - Auth: `GOOGLE_API_KEY` environment variable
  - Usage: Via AI SDK v5 provider wrapper

- Deepseek - LLM provider
  - SDK: `@ai-sdk/deepseek-v5` (v1.0.31)
  - Auth: `DEEPSEEK_API_KEY` environment variable

- Mistral - Open source LLM
  - SDK: `@ai-sdk/mistral-v5` (v2.0.24)
  - Auth: `MISTRAL_API_KEY` environment variable

- xAI (Grok)
  - SDK: `@ai-sdk/xai-v5` (v2.0.33)
  - Auth: `XAI_API_KEY` environment variable

- Perplexity
  - SDK: `@ai-sdk/perplexity-v5` (v2.0.5)
  - Auth: `PERPLEXITY_API_KEY` environment variable

- OpenRouter - Model router/gateway
  - SDK: `@openrouter/ai-sdk-provider-v5` (v1.2.3)
  - Auth: `OPENROUTER_API_KEY` environment variable

- Azure OpenAI
  - SDK: `@ai-sdk/azure` (v2.0.0)
  - Auth: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` environment variables

- Custom OpenAI-Compatible Gateways
  - SDK: `@ai-sdk/openai-compatible-v5` (v1.0.27)
  - Supports custom endpoints for LLM routers and embedding models

**Voice & Speech Services:**
- OpenAI - Voice synthesis and speech recognition
  - SDK: `openai` (v5.11.0) in `voice/openai/`
  - Auth: `OPENAI_API_KEY`

- ElevenLabs - Voice synthesis
  - Location: `voice/elevenlabs/`
  - Auth: `ELEVENLABS_API_KEY`

- Google Cloud Speech - Speech to text and synthesis
  - Location: `voice/google/`
  - Auth: `GOOGLE_CLOUD_CREDENTIALS` JSON credentials

- Deepgram - Speech recognition
  - Location: `voice/deepgram/`
  - Auth: `DEEPGRAM_API_KEY`

- Cloudflare - Text-to-speech
  - Location: `voice/cloudflare/`
  - Auth: Cloudflare API token

- Azure Speech Services
  - Location: `voice/azure/`
  - Auth: Azure cognitive services credentials

- Google Gemini Live API
  - Location: `voice/google-gemini-live-api/`
  - Real-time voice interaction

- OpenAI Realtime API
  - Location: `voice/openai-realtime-api/`
  - Real-time voice conversation

- Murf - Voice synthesis
  - Location: `voice/murf/`

- PlayAI - Voice synthesis
  - Location: `voice/playai/`

- Sarvam - Speech services
  - Location: `voice/sarvam/`

- Speechify - Text-to-speech
  - Location: `voice/speechify/`

- Gladia - Speech recognition
  - Location: `voice/gladia/`

## Data Storage

**Databases:**
- PostgreSQL 16+ (with pgvector 0.8.0+ for vector support)
  - Adapter: `stores/pg/` - Uses `pg` client (v8.16.3)
  - Connection: `process.env.DATABASE_URL`
  - Used for: Workflows, scores, general storage

- MongoDB 7.0.0+
  - Adapter: `stores/mongodb/`
  - Client: `mongodb` (v7.0.0)
  - Uses CloudFlare SDK for certain operations

- DuckDB
  - Adapter: `stores/duckdb/`
  - In-process SQL database

- ClickHouse
  - Adapter: `stores/clickhouse/`
  - OLAP database for analytics

- MSSQL (SQL Server)
  - Adapter: `stores/mssql/`
  - Enterprise SQL database

- LibSQL (SQLite compatible)
  - Adapter: `stores/libsql/`
  - Lightweight SQL database

- Cloudflare D1
  - Adapter: `stores/cloudflare-d1/`
  - Serverless SQL on Cloudflare
  - Client: `cloudflare` (v4.5.0)

- Convex
  - Adapter: `stores/convex/`
  - Realtime sync database

- Couchbase
  - Adapter: `stores/couchbase/`
  - Document database

**Vector Stores:**
- Pinecone
  - Adapter: `stores/pinecone/`
  - Client: `@pinecone-database/pinecone` (v3.0.3)
  - Serverless vector database

- Chroma
  - Adapter: `stores/chroma/`
  - Client: `chromadb` (v3.1.6)
  - Open-source embedding database

- Qdrant
  - Adapter: `stores/qdrant/`
  - Vector search engine (Docker service at localhost:6333)

- Elasticsearch
  - Adapter: `stores/elasticsearch/`
  - Client: `@elastic/elasticsearch` (v8.17.0)
  - Full-text and vector search

- OpenSearch
  - Adapter: `stores/opensearch/`
  - Open-source Elasticsearch fork

- Astra (DataStax)
  - Adapter: `stores/astra/`
  - Vector database as a service

- Lance
  - Adapter: `stores/lance/`
  - Modern vector database

- S3Vectors
  - Adapter: `stores/s3vectors/`
  - Vector search on S3

- Turbopuffer
  - Adapter: `stores/turbopuffer/`
  - Vector database

- Upstash
  - Adapter: `stores/upstash/`
  - Serverless Redis with vector support

- Cloudflare Vectorize
  - Adapter: `stores/vectorize/`
  - Cloudflare's vector database service

**In-Memory Caching:**
- Redis 7+
  - Docker service at localhost:6379
  - Used for caching and session storage

## Authentication & Identity

**Auth Providers:**
- Clerk - User authentication
  - Package: `auth/clerk/`
  - SDK: `@clerk/backend` (v1.34.0)
  - Auth: `CLERK_API_KEY`, `CLERK_SECRET_KEY` environment variables

- Auth0 - OAuth/OIDC provider
  - Package: `auth/auth0/`
  - SDK: `jose` (v6.1.2) for JWT handling
  - Auth: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`

- Better-Auth - Self-hosted auth
  - Package: `auth/better-auth/`
  - SDK: `better-auth` (v1.4.12)
  - Supports multiple sessions and OAuth

- Supabase - PostgreSQL + Auth
  - Package: `auth/supabase/`
  - SDK: `@supabase/supabase-js` (v2.50.3)
  - Auth: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

- Firebase - Google authentication
  - Package: `auth/firebase/`
  - JWT-based auth integration

- WorkOS - Enterprise SSO
  - Package: `auth/workos/`
  - Enterprise authentication

## Monitoring & Observability

**LLM Observability:**
- Langfuse - LLM observability
  - Package: `observability/langfuse/`
  - SDK: `langfuse` (v3.38.6)
  - Auth: `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`

- LangSmith - LLM debugging
  - Package: `observability/langsmith/`
  - Auth: `LANGSMITH_API_KEY`

- BrainTrust - Model evaluation
  - Package: `observability/braintrust/`
  - Auth: `BRAINTRUST_API_KEY`

- Arize - ML monitoring
  - Package: `observability/arize/`

- Laminar - Inference debugging
  - Package: `observability/laminar/`

**Telemetry & Traces:**
- OpenTelemetry (OTEL) - Distributed tracing
  - Packages: `observability/otel-bridge/`, `observability/otel-exporter/`
  - SDK: `@opentelemetry/api` (v1.9.0)

- Datadog - Application monitoring
  - Package: `observability/datadog/`

- Sentry - Error tracking
  - Package: `observability/sentry/`
  - SDK: `@sentry/node` (v10.32.1) available in dependencies

- PostHog - Product analytics
  - Package: `observability/posthog/`
  - SDK: `posthog-node` (v5.17.2) in CLI and other packages

- Mastra Native - Built-in observability
  - Package: `observability/mastra/`
  - Custom telemetry framework

## Message Queue & Pub/Sub

**Event Distribution:**
- Google Cloud Pub/Sub
  - Package: `pubsub/google-cloud-pubsub/`
  - Distributed message queuing

## CI/CD & Deployment

**Hosting Platforms:**
- Vercel
  - Deployer: `deployers/vercel/`
  - Functions deployment, edge runtime support

- Netlify
  - Deployer: `deployers/netlify/`
  - Static and serverless deployment

- Cloudflare
  - Deployer: `deployers/cloudflare/`
  - SDK: `cloudflare` (v4.5.0)
  - Workers and D1 database support

- Cloud.run / Generic Cloud
  - Deployer: `deployers/cloud/`
  - Containerized deployment

**CI Pipeline:**
- GitHub Actions (via `.github/workflows/`)
- Changesets for versioning and publishing

## Server Adapters

**Framework Adapters:**
- Express - Traditional Node.js framework
  - Adapter: `server-adapters/express/`
  - Integration for routing and middleware

- Hono - Edge-first framework
  - Adapter: `server-adapters/hono/`
  - Primary server framework used in core

- Fastify - High-performance framework
  - Adapter: `server-adapters/fastify/`

- Koa - Middleware-focused framework
  - Adapter: `server-adapters/koa/`

## Environment Configuration

**Required env vars:**
- LLM API Keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`
- Database: `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Voice/Speech: `ELEVENLABS_API_KEY`, `DEEPGRAM_API_KEY`
- Auth: Provider-specific (Clerk, Auth0, Supabase, etc.)
- Observability: `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `SENTRY_DSN`

**Secrets location:**
- Local development: `.env` file (not committed)
- CI: GitHub repository secrets
- Deployment: Platform-specific secret management (Vercel, Netlify, Cloudflare, etc.)

## Webhook & Callback Integration

**Incoming Webhooks:**
- Voice callbacks from speech services
- Auth provider callbacks (OAuth redirects)
- LLM provider events (usage, errors)

**Outgoing Webhooks:**
- Workflow callbacks to user applications
- Event notifications via configured endpoints

## Model Context Protocol (MCP)

**MCP Integration:**
- SDK: `@modelcontextprotocol/sdk` (v1.17.5)
- Package: `packages/mcp/`
- Enables external tool integration via standardized protocol

## Utilities & Dependencies

**Content Processing:**
- `js-tiktoken` - Token counting for cost estimation and context management
- `node-html-better-parser` - HTML parsing for web content
- RAG content processing in `packages/rag/`

**Testing Utilities:**
- MSW (Mock Service Worker) - HTTP request mocking for integration tests
- Vitest environment: jsdom available for DOM testing

---

*Integration audit: 2026-01-23*
