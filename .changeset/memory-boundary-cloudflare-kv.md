---
'@mastra/cloudflare': patch
---

Improved `messageHistory` trim boundary persistence. Durable Objects now persist boundaries atomically across app instances. Workers KV cannot return an authoritative boundary across replicas, so it conservatively skips distributed persistence; the token budget is still applied on every request, so prompts stay within `maxTokens`.
