---
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Registered the new `mastra_saved_views` table so these stores keep building against the latest `@mastra/core`. Cloudflare Workers users who pass KV `bindings` need one more binding, `mastra_saved_views`.
