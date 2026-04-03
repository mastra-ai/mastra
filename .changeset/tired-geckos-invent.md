---
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
'@mastra/client-js': patch
'@mastra/opencode': patch
'@mastra/datadog': patch
'@mastra/laminar': patch
'@mastra/posthog': patch
'@mastra/deployer-cloudflare': patch
'@mastra/observability': patch
'@mastra/sentry': patch
'@mastra/hono': patch
'@mastra/arize': patch
'@mastra/koa': patch
'@mastra/react': patch
'@mastra/deployer-netlify': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
'mastracode': patch
---

Derive gateway and studio URLs from platform URL so staging/prod environments stay consistent. MASTRA_GATEWAY_URL and MASTRA_STUDIO_URL are now automatically set based on MASTRA_PLATFORM_API_URL, with env var overrides for each.
