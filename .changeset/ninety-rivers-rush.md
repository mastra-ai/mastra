---
'@mastra/client-js': major
'@mastra/core': major
'@mastra/server': major
'@mastra/acp': patch
'@mastra/agent-browser': patch
'@mastra/agent-builder': patch
'@mastra/agentcore': patch
'@mastra/agentfs': patch
'@mastra/ai-sdk': patch
'@mastra/archil': patch
'@mastra/arize': patch
'@mastra/arthur': patch
'@mastra/astra': patch
'@mastra/auth-neon': patch
'@mastra/azure': patch
'@mastra/blaxel': patch
'@mastra/braintrust': patch
'@mastra/brightdata': patch
'@mastra/browser-firecrawl': patch
'@mastra/browser-viewer': patch
'@mastra/chroma': patch
'@mastra/claude': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/cloudflare-d1': patch
'@mastra/convex': patch
'@mastra/couchbase': patch
'@mastra/cursor': patch
'@mastra/datadog': patch
'@mastra/daytona': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-cloudflare': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer-vercel': patch
'@mastra/docker': patch
'@mastra/dsql': patch
'@mastra/duckdb': patch
'@mastra/dynamodb': patch
'@mastra/e2b': patch
'@mastra/editor': patch
'@mastra/elasticsearch': patch
'@mastra/evals': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/files-sdk': patch
'@mastra/gcs': patch
'@mastra/github-signals': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/google-drive': patch
'@mastra/hono': patch
'@mastra/inngest': patch
'@mastra/koa': patch
'@mastra/laminar': patch
'@mastra/lance': patch
'@mastra/langfuse': patch
'@mastra/langsmith': patch
'@mastra/libsql': patch
'@mastra/loggers': patch
'@mastra/mcp': patch
'@mastra/mcp-registry-registry': patch
'@mastra/memory': patch
'@mastra/modal': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/nestjs': patch
'@mastra/next': patch
'@mastra/observability': patch
'@mastra/openai': patch
'@mastra/opensearch': patch
'@mastra/otel-bridge': patch
'@mastra/otel-exporter': patch
'@mastra/perplexity': patch
'@mastra/pg': patch
'@mastra/pinecone': patch
'@mastra/playground-ui': patch
'@mastra/posthog': patch
'@mastra/qdrant': patch
'@mastra/rag': patch
'@mastra/railway': patch
'@mastra/react': patch
'@mastra/redis': patch
'@mastra/redis-streams': patch
'@mastra/s3': patch
'@mastra/s3vectors': patch
'@mastra/sentry': patch
'@mastra/slack': patch
'@mastra/spanner': patch
'@mastra/stagehand': patch
'@mastra/tanstack-start': patch
'@mastra/tavily': patch
'@mastra/temporal': patch
'@mastra/turbopuffer': patch
'@mastra/upstash': patch
'@mastra/vectorize': patch
'@mastra/vercel': patch
'mastra': patch
'mastracode': patch
---

**Removed `AgentControllerMessage` and the deprecated `HarnessMessage` type. The AgentController now produces, streams, persists, and returns the canonical `MastraDBMessage` shape.**

The AgentController used to expose a bespoke, flattened message type whose `content` was a flat array of items like `text`, `tool_call`, and `tool_result`. It now uses `MastraDBMessage` everywhere — the same persisted shape used across the rest of Mastra — where `content` is an object with a `content.parts` array.

This affects the `message_start`, `message_update`, and `message_end` events, the display state's `currentMessage`, and the messages returned by `listMessages`, `listActiveMessages`, `firstUserMessage`, and `firstUserMessages`. Signals such as system reminders and notifications now arrive as separate messages with `role: 'signal'` instead of being flattened into assistant message content.

Streamed run messages now keep assistant and signal updates in the persisted message format, and dependent packages have been bumped for the core 2.0.0 compatibility change.

**Before**

```typescript
agentController.subscribe(event => {
  if (event.type === 'message_update') {
    const text = event.message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }
});
```

**After**

```typescript
agentController.subscribe(event => {
  if (event.type === 'message_update') {
    const text = event.message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  }
});
```

Import `MastraDBMessage` from `@mastra/core/agent-controller` in place of the removed `AgentControllerMessage`.
