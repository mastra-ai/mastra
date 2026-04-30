---
'@mastra/observability': minor
'@mastra/mcp-registry-registry': patch
'@mastra/otel-exporter': patch
'@mastra/otel-bridge': patch
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
'@mastra/arthur': patch
'@mastra/sentry': patch
'@mastra/hono': patch
'@mastra/elasticsearch': patch
'@mastra/arize': patch
'@mastra/koa': patch
'@mastra/daytona': patch
'@mastra/react': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/clickhouse': patch
'@mastra/deployer-vercel': patch
'@mastra/azure': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/evals': patch
'@mastra/e2b': patch
'@mastra/core': patch
'@mastra/convex': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/auth-studio': patch
'mastracode': patch
'@mastra/pg': patch
---

Auto-attach the Mastra-level `environment` to every span, log, and metric.

When a parent `Mastra` instance has `environment` configured (or `process.env.NODE_ENV` set), `Observability` propagates it to every registered instance during `setMastraContext`. Spans use it as a fallback for `CorrelationContext.environment` when `metadata.environment` is not set on a specific call.
