---
'@mastra/core': minor
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
'@mastra/observability': patch
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
'@mastra/convex': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/auth-studio': patch
'mastracode': patch
'@mastra/pg': patch
---

Added top-level `environment` config on `Mastra` to tag observability signals with the deployment environment.

Set it once on the `Mastra` instance and it will be attached to every trace, log, and metric automatically. Falls back to `process.env.NODE_ENV` when unset; per-call `tracingOptions.metadata.environment` still takes precedence.

**Before**

```ts
await agent.generate('hello', {
  tracingOptions: { metadata: { environment: process.env.NODE_ENV } },
});
```

**After**

```ts
new Mastra({
  environment: 'production',
  observability: new Observability({ ... }),
})
```

`mastra.getEnvironment()` returns the resolved value.
