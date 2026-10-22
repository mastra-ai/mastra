---
'@mastra/hono': patch
---

Fixed the Hono adapter reading oversized JSON request bodies in full before the body size limit and auth were applied. The `requestContext` lookup now stops at the route's body limit (or the server-wide `bodySizeLimit` for custom API routes), so a declared oversized `Content-Length` is rejected without reading the body, and chunked bodies are read only up to the limit before the 413 response. `@mastra/next` and `@mastra/tanstack-start` get the fix through `@mastra/hono`.
