---
'@mastra/client-js': major
'@mastra/mcp-registry-registry': patch
'@mastra/tanstack-start': patch
'@mastra/otel-exporter': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/otel-bridge': patch
'@mastra/braintrust': patch
'@mastra/brightdata': patch
'@mastra/perplexity': patch
'@mastra/langsmith': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/google-drive': patch
'@mastra/browser-viewer': patch
'@mastra/langfuse': patch
'@mastra/agent-builder': patch
'@mastra/playground-ui': patch
'@mastra/nestjs': patch
'@mastra/agent-browser': patch
'@mastra/datadog': patch
'@mastra/laminar': patch
'@mastra/posthog': patch
'@mastra/deployer-cloudflare': patch
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
'@mastra/react': patch
'@mastra/deployer-netlify': patch
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
'@mastra/pinecone': patch
'@mastra/acp': patch
'@mastra/slack': patch
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
'@mastra/s3': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
'@mastra/astra': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'mastracode': patch
'@mastra/auth-neon': patch
'@mastra/pg': patch
---

**The agent-controller client now uses the `MastraDBMessage` shape for messages.**

`listMessages` and the `message_start` / `message_update` / `message_end` events now return messages whose `content` is an object with a `content.parts` array, matching the persisted `MastraDBMessage` shape used across Mastra. The locally-defined `AgentControllerMessage` and `AgentControllerMessageContent` types were removed.

The `agentControllerMessageText` helper is unchanged in usage — it now reads the text from `content.parts` for you.

**Before**

```typescript
const messages = await client.agentController('my-controller').listMessages({ threadId });
const text = messages[0].content
  .filter(part => part.type === 'text')
  .map(part => part.text)
  .join('');
```

**After**

```typescript
import { agentControllerMessageText } from '@mastra/client-js';

const messages = await client.agentController('my-controller').listMessages({ threadId });
const text = agentControllerMessageText(messages[0]);
```
