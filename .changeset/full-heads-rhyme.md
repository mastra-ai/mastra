---
'@mastra/cloudflare': patch
---

Fixed Cloudflare KV storage silently dropping data once a table grows past 1000 keys. Listing threads, deleting threads, and clearing tables now read every page of keys from Cloudflare instead of only the first one, so large stores no longer lose threads or leave orphaned messages behind. Also fixed writes through the REST API, which Cloudflare rejected with a 'metadata must be valid json' error. Fixes https://github.com/mastra-ai/mastra/issues/22015
