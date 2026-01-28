---
"@mastra/core": patch
---

Fix TypeScript types for custom API route handlers to include `requestContext` in Hono context Variables. Previously, only `mastra` was typed, causing TypeScript errors when accessing `c.get('requestContext')` even though the runtime correctly provided this context.
