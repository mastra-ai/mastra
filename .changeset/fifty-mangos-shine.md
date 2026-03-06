---
'@mastra/fastify': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/hono': patch
'@mastra/cloudflare-d1': patch
'@mastra/koa': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/evals': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Improved type safety for serialized requestContext by using `Record<string, unknown>` instead of `Record<string, any>`. This stricter typing ensures consumers properly narrow values before use, catching potential type errors at compile time rather than runtime.
