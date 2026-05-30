---
'@mastra/memory': patch
---

Fix working memory crashing on Cloudflare Workers when using a Zod schema. The working-memory tool now validates input with the schema's own validator instead of re-wrapping it through AJV, which compiles validators with `new Function`/`eval` and is blocked on runtimes that forbid dynamic code generation.
