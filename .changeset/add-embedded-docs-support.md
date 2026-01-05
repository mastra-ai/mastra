---
"@mastra/core": patch
"@mastra/memory": patch
"@mastra/rag": patch
"@mastra/evals": patch
"@mastra/deployer": patch
"@mastra/deployer-cloudflare": patch
"@mastra/deployer-netlify": patch
"@mastra/deployer-vercel": patch
"@mastra/server": patch
"@mastra/mcp": patch
"@mastra/client-js": patch
"@mastra/ai-sdk": patch
"@mastra/auth": patch
"@mastra/loggers": patch
"@mastra/observability": patch
"@mastra/otel-bridge": patch
"@mastra/otel-exporter": patch
"@mastra/arize": patch
"@mastra/braintrust": patch
"@mastra/langfuse": patch
"@mastra/langsmith": patch
"@mastra/posthog": patch
"@mastra/libsql": patch
"@mastra/pg": patch
"@mastra/upstash": patch
"@mastra/mongodb": patch
"@mastra/astra": patch
"@mastra/chroma": patch
"@mastra/clickhouse": patch
"@mastra/cloudflare": patch
"@mastra/cloudflare-d1": patch
"@mastra/convex": patch
"@mastra/couchbase": patch
"@mastra/duckdb": patch
"@mastra/dynamodb": patch
"@mastra/elasticsearch": patch
"@mastra/lance": patch
"@mastra/mssql": patch
"@mastra/opensearch": patch
"@mastra/pinecone": patch
"@mastra/qdrant": patch
"@mastra/s3vectors": patch
"@mastra/turbopuffer": patch
"@mastra/vectorize": patch
"@mastra/fastembed": patch
"@mastra/express": patch
"@mastra/hono": patch
"@mastra/voice-azure": patch
"@mastra/voice-cloudflare": patch
"@mastra/voice-deepgram": patch
"@mastra/voice-elevenlabs": patch
"@mastra/voice-google": patch
"@mastra/voice-google-gemini-live": patch
"@mastra/voice-murf": patch
"@mastra/voice-openai": patch
"@mastra/voice-openai-realtime": patch
"@mastra/voice-playai": patch
"@mastra/voice-sarvam": patch
"@mastra/voice-speechify": patch
---

Add embedded documentation support for Mastra packages

Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

Each package includes:
- **SKILL.md** - Entry point explaining the package's purpose and capabilities
- **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
- **Topic folders** - Conceptual documentation organized by feature area

Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

