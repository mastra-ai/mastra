# External Integrations

**Analysis Date:** 2026-01-26

## AI/LLM Providers

**Vercel AI SDK (Primary AI Interface):**

- SDK: `@ai-sdk/provider-v5` (2.0.0), `@ai-sdk/provider-v6` (3.0.0)
- Used for: LLM abstraction, streaming, tool calls
- Configuration: Model string format `provider/model-name`
- Env vars: Provider-specific API keys

**Supported LLM Providers:**

- OpenAI - `@ai-sdk/openai` - `OPENAI_API_KEY`
- Anthropic - `@ai-sdk/anthropic` - `ANTHROPIC_API_KEY`
- Google - `@ai-sdk/google` - `GOOGLE_GENERATIVE_AI_API_KEY`
- Azure OpenAI - `@ai-sdk/azure` - Azure credentials
- Mistral - `@ai-sdk/mistral` - `MISTRAL_API_KEY`
- Groq - via OpenAI-compatible - `GROQ_API_KEY`
- Cerebras - via OpenAI-compatible - `CEREBRAS_API_KEY`
- DeepSeek - `@ai-sdk/deepseek` - `DEEPSEEK_API_KEY`
- xAI - `@ai-sdk/xai` - `XAI_API_KEY`
- Perplexity - `@ai-sdk/perplexity` - `PERPLEXITY_API_KEY`
- OpenRouter - `@openrouter/ai-sdk-provider` - `OPENROUTER_API_KEY`

**Model Context Protocol (MCP):**

- SDK: `@modelcontextprotocol/sdk` 1.17.5
- Package: `packages/mcp/`
- Used for: External tool integration, server-side MCP

## Data Storage

**Vector Stores (`stores/` directory):**
| Store | Package | Client Library |
|-------|---------|----------------|
| PostgreSQL + pgvector | `@mastra/pg` | `pg` 8.16.3 |
| Pinecone | `@mastra/pinecone` | `@pinecone-database/pinecone` 3.0.3 |
| Chroma | `@mastra/chroma` | `chromadb` 3.1.6 |
| Qdrant | `@mastra/qdrant` | `@qdrant/js-client-rest` |
| MongoDB | `@mastra/mongodb` | `mongodb` 7.0.0 |
| LibSQL/Turso | `@mastra/libsql` | `@libsql/client` |
| Upstash | `@mastra/upstash` | `@upstash/vector` |
| LanceDB | `@mastra/lance` | `lancedb` |
| Elasticsearch | `@mastra/elasticsearch` | `@elastic/elasticsearch` |
| OpenSearch | `@mastra/opensearch` | `@opensearch-project/opensearch` |
| Cloudflare Vectorize | `@mastra/vectorize` | Cloudflare Workers API |
| Cloudflare D1 | `@mastra/cloudflare-d1` | Cloudflare Workers API |
| AWS DynamoDB | `@mastra/dynamodb` | `@aws-sdk/client-dynamodb` |
| MS SQL Server | `@mastra/mssql` | `tedious` |
| ClickHouse | `@mastra/clickhouse` | `@clickhouse/client` |
| Couchbase | `@mastra/couchbase` | `couchbase` |
| Convex | `@mastra/convex` | `convex` |
| Astra DB | `@mastra/astra` | `@datastax/astra-db-ts` |
| Turbopuffer | `@mastra/turbopuffer` | `@turbopuffer/turbopuffer` |
| S3 Vectors | `@mastra/s3vectors` | AWS S3 SDK |
| DuckDB | `@mastra/duckdb` | `duckdb` |

**Development Docker Services:**

- PostgreSQL + pgvector 0.8.0 (port 5432)
- Qdrant (port 6333)
- Redis (port 6379)
- Config: `.dev/docker-compose.yaml`

## Authentication Providers

**Auth Integrations (`auth/` directory):**
| Provider | Package | Client Library |
|----------|---------|----------------|
| Clerk | `@mastra/auth-clerk` | `@clerk/backend` 1.34.0 |
| Supabase | `@mastra/auth-supabase` | `@supabase/supabase-js` 2.50.3 |
| Auth0 | `@mastra/auth-auth0` | Auth0 SDK |
| Firebase | `@mastra/auth-firebase` | Firebase Admin SDK |
| Better Auth | `@mastra/auth-better-auth` | `better-auth` 1.4.5 |
| WorkOS | `@mastra/auth-workos` | WorkOS SDK |

## Voice/Speech Providers

**Voice Integrations (`voice/` directory):**
| Provider | Package | SDK |
|----------|---------|-----|
| OpenAI | `@mastra/voice-openai` | `openai` 5.11.0 |
| OpenAI Realtime | `@mastra/voice-openai-realtime-api` | OpenAI Realtime API |
| ElevenLabs | `@mastra/voice-elevenlabs` | ElevenLabs SDK |
| Deepgram | `@mastra/voice-deepgram` | Deepgram SDK |
| Google | `@mastra/voice-google` | Google Cloud TTS |
| Google Gemini Live | `@mastra/voice-google-gemini-live-api` | Gemini Live API |
| Gladia | `@mastra/voice-gladia` | Gladia API |
| Azure | `@mastra/voice-azure` | Azure Cognitive Services |
| Cloudflare | `@mastra/voice-cloudflare` | Cloudflare AI |
| Murf | `@mastra/voice-murf` | Murf API |
| PlayAI | `@mastra/voice-playai` | PlayAI SDK |
| Speechify | `@mastra/voice-speechify` | Speechify SDK |
| Sarvam | `@mastra/voice-sarvam` | Sarvam API |

## Observability & Monitoring

**Observability Integrations (`observability/` directory):**
| Provider | Package | SDK |
|----------|---------|-----|
| Langfuse | `@mastra/langfuse` | `langfuse` 3.38.6 |
| LangSmith | `@mastra/langsmith` | LangSmith SDK |
| Sentry | `@mastra/sentry` | Sentry SDK |
| PostHog | `@mastra/posthog` | PostHog SDK |
| Datadog | `@mastra/datadog` | Datadog SDK |
| Braintrust | `@mastra/braintrust` | Braintrust SDK |
| Laminar | `@mastra/laminar` | Laminar SDK |
| Arize | `@mastra/arize` | Arize SDK |
| OpenTelemetry Bridge | `@mastra/otel-bridge` | OpenTelemetry SDK |
| OpenTelemetry Exporter | `@mastra/otel-exporter` | OTLP Exporter |
| Mastra Observability | `@mastra/observability` | Internal |

## Deployment Platforms

**Deployer Integrations (`deployers/` directory):**
| Platform | Package | Notes |
|----------|---------|-------|
| Vercel | `@mastra/deployer-vercel` | Serverless functions |
| Netlify | `@mastra/deployer-netlify` | Netlify Functions |
| Cloudflare | `@mastra/deployer-cloudflare` | Cloudflare Workers |
| Mastra Cloud | `@mastra/deployer-cloud` | Managed hosting |

## Server Adapters

**HTTP Framework Adapters (`server-adapters/` directory):**
| Framework | Package | SDK |
|-----------|---------|-----|
| Hono | `@mastra/hono` | `hono` 4.11.3 |
| Express | `@mastra/express` | `express` 5.x |
| Fastify | `@mastra/fastify` | `fastify` |
| Koa | `@mastra/koa` | `koa` |

## Client SDKs

**Client Libraries (`client-sdks/` directory):**
| Client | Package | Dependencies |
|--------|---------|--------------|
| JavaScript/TypeScript | `@mastra/client-js` | Fetch API |
| React | `@mastra/react` | React 19+, @tanstack/react-query |
| AI SDK Adapter | `@mastra/ai-sdk` | Vercel AI SDK |

## Pub/Sub Integrations

**Message Queue (`pubsub/` directory):**

- Google Cloud Pub/Sub - `@mastra/google-cloud-pubsub` - `@google-cloud/pubsub`

## Environment Configuration

**Required Environment Variables (by feature):**

**LLM:**

- `OPENAI_API_KEY` - OpenAI models
- `ANTHROPIC_API_KEY` - Anthropic Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google Gemini models
- `MODEL` - Default model (format: `provider/model-name`)

**Storage:**

- `DATABASE_URL` or `POSTGRES_*` - PostgreSQL connection
- Provider-specific credentials for managed vector stores

**Observability:**

- `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` - Langfuse
- `SENTRY_DSN` - Sentry error tracking
- Provider-specific keys for other observability platforms

**Secrets Location:**

- `.env` files in project root (not committed)
- `.env.example` templates in examples/templates

## Webhooks & Callbacks

**Incoming:**

- Server exposes REST API endpoints via Hono
- A2A (Agent-to-Agent) protocol support via `@a2a-js/sdk`
- MCP server endpoints for tool discovery

**Outgoing:**

- LLM API calls to provider endpoints
- Storage operations to database/vector store services
- Observability data to telemetry endpoints
- Analytics to PostHog (`posthog-node` in CLI)

---

_Integration audit: 2026-01-26_
