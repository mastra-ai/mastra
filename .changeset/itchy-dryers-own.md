---
'@mastra/memory': patch
---

Fixed a crash in Cloudflare Workers when using a Zod schema for working memory. Working-memory input is now validated directly by the provided schema validator, which avoids runtime restrictions in Cloudflare Workers.
