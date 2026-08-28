---
'@mastra/cloudflare': patch
---

Added the new `mastra_channel_state` table to the KV table types for compatibility with the latest `@mastra/core`. If you pass per-table KV namespace bindings on Cloudflare Workers, add a binding for `mastra_channel_state`.
