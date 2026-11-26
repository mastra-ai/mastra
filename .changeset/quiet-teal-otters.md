---
'@mastra/core': patch
---

Fixed messages not being saved or recalled when observational memory is enabled on a storage adapter that doesn't support it (for example Cloudflare D1). Memory now falls back to normal message history on these stores and logs a single warning naming the store, instead of silently dropping conversation history.
