---
'@mastra/docker': minor
'@mastra/mcp-registry-registry': patch
'@mastra/voice-google-gemini-live': patch
'@mastra/otel-exporter': patch
'@mastra/google-cloud-pubsub': patch
'@mastra/otel-bridge': patch
'@mastra/voice-openai-realtime': patch
'@mastra/longmemeval': patch
'@mastra/braintrust': patch
'@mastra/mcp-docs-server': patch
'@mastra/langsmith': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/langfuse': patch
'@mastra/agent-builder': patch
'create-mastra': patch
'@mastra/playground-ui': patch
'@mastra/schema-compat': patch
'@mastra/client-js': patch
'@mastra/opencode': patch
'@mastra/datadog': patch
'@mastra/laminar': patch
'@mastra/posthog': patch
'@mastra/deployer-cloudflare': patch
'@mastra/observability': patch
'@mastra/sentry': patch
'@mastra/hono': patch
'@mastra/cloudflare-d1': patch
'@mastra/elasticsearch': patch
'@mastra/arize': patch
'@mastra/koa': patch
'@mastra/ai-sdk': patch
'@mastra/fastembed': patch
'@mastra/turbopuffer': patch
'@mastra/agentfs': patch
'@mastra/daytona': patch
'@mastra/react': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/opensearch': patch
'@mastra/inngest': patch
'@mastra/blaxel': patch
'@mastra/auth-better-auth': patch
'@mastra/deployer-vercel': patch
'@mastra/codemod': patch
'@mastra/loggers': patch
'@mastra/couchbase': patch
'@mastra/s3vectors': patch
'@mastra/vectorize': patch
'@mastra/voice-cloudflare': patch
'@mastra/voice-elevenlabs': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/pinecone': patch
'@mastra/voice-modelslab': patch
'@mastra/voice-speechify': patch
'@mastra/evals': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/voice-deepgram': patch
'@mastra/e2b': patch
'@mastra/gcs': patch
'@mastra/auth-firebase': patch
'@mastra/auth-supabase': patch
'@mastra/auth': patch
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
'@mastra/voice-gladia': patch
'@mastra/voice-google': patch
'@mastra/voice-openai': patch
'@mastra/voice-playai': patch
'@mastra/voice-sarvam': patch
'@mastra/auth-studio': patch
'@mastra/auth-workos': patch
'@mastra/voice-azure': patch
'@mastra/auth-auth0': patch
'@mastra/auth-clerk': patch
'@mastra/auth-cloud': patch
'mastracode': patch
'@mastra/voice-murf': patch
'@mastra/pg': patch
---

Added @mastra/docker, a Docker container sandbox provider for Mastra workspaces. Executes commands inside local Docker containers using long-lived containers with `docker exec`. Supports bind mounts, environment variables, container reconnection by label, custom images, and network configuration. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary.

**Usage**

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    timeout: 60_000,
  }),
});

const agent = new Agent({
  name: 'dev-agent',
  model: 'anthropic/claude-opus-4-6',
  workspace,
});
```
