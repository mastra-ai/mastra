---
'@mastra/cloudflare': patch
---

The Cloudflare KV store now recognizes the `mastra_channel_state` table used by `@mastra/core`, so it stays compatible when you upgrade core. If you pass per-table KV namespace bindings on Cloudflare Workers, add a binding for `mastra_channel_state`.
