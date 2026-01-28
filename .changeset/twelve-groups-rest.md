---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Fixed route prefix behavior to correctly replace the default /api prefix instead of prepending to it. Previously, setting prefix: '/api/v2' resulted in routes at /api/v2/api/agents. Now routes correctly appear at /api/v2/agents as documented.
