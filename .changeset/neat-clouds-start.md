---
'@mastra/code-sdk': major
'@mastra/mcp-registry-registry': patch
'@mastra/tanstack-start': patch
'@mastra/cloudflare-sandbox': patch
'@mastra/platform-workspace': patch
'@mastra/otel-exporter': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/apple-container': patch
'@mastra/otel-bridge': patch
'@mastra/braintrust': patch
'@mastra/brightdata': patch
'@mastra/perplexity': patch
'@mastra/langsmith': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/google-drive': patch
'@mastra/browser-viewer': patch
'@mastra/deepeval': patch
'@mastra/langfuse': patch
'@mastra/agent-builder': patch
'@mastra/playground-ui': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/e2b-desktop': patch
'@mastra/agent-browser': patch
'@mastra/isolated-vm': patch
'@mastra/parallel': patch
'@mastra/datadog': patch
'@mastra/laminar': patch
'@mastra/posthog': patch
'@mastra/valkey-streams': patch
'@mastra/deployer-cloudflare': patch
'@mastra/livekit': patch
'@mastra/arthur': patch
'@mastra/observability': patch
'@mastra/sentry': patch
'@mastra/redis-streams': patch
'@mastra/hono': patch
'@mastra/next': patch
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/agentcore': patch
'@mastra/files-sdk': patch
'@mastra/tavily': patch
'@mastra/arize': patch
'@mastra/koa': patch
'@mastra/ai-sdk': patch
'@mastra/turbopuffer': patch
'@mastra/temporal': patch
'@mastra/agentfs': patch
'@mastra/daytona': patch
'@mastra/railway': patch
'@mastra/claude': patch
'@mastra/cursor': patch
'@mastra/openai': patch
'@mastra/browser-firecrawl': patch
'@mastra/stagehand': patch
'@mastra/telegram': patch
'@mastra/react': patch
'@mastra/quickjs': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-sandbox': patch
'@mastra/deployer': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/opensearch': patch
'@mastra/inngest': patch
'@mastra/archil': patch
'@mastra/blaxel': patch
'@mastra/docker': patch
'@mastra/vercel': patch
'@mastra/deployer-vercel': patch
'@mastra/loggers': patch
'@mastra/couchbase': patch
'@mastra/s3vectors': patch
'@mastra/vectorize': patch
'@mastra/azure': patch
'@mastra/modal': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/oracledb': patch
'@mastra/pinecone': patch
'@mastra/mesa': patch
'@mastra/acp': patch
'@mastra/slack': patch
'mastracode': patch
'@mastra/evals': patch
'@mastra/github-signals': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/e2b': patch
'@mastra/gcs': patch
'@mastra/core': patch
'@mastra/chroma': patch
'@mastra/convex': patch
'@mastra/duckdb': patch
'@mastra/libsql': patch
'@mastra/qdrant': patch
'@mastra/valkey': patch
'@mastra/s3': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
'@mastra/astra': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/turso': patch
'@mastra/dsql': patch
'@mastra/auth-neon': patch
'@mastra/pg': patch
---

**Breaking:** Token estimation and context auditing now return promises.

Before:

```ts
const tokens = tokenEstimate(text);
```

After:

```ts
const tokens = await tokenEstimate(text);
```

This lets token utilities load safely at runtime.
