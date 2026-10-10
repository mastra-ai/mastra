---
'@mastra/cloudflare': patch
---

Fixed `listMessagesById` in Cloudflare KV storage returning an empty list when a lookup fails. It now throws, like the other storage adapters, so a temporary KV outage is no longer mistaken for the messages having been deleted.
