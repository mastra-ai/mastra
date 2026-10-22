---
'@mastra/hono': patch
---

Fixed the Hono adapter reading oversized JSON request bodies in full before the body size limit and auth were applied. The `requestContext` lookup now reads at most the route's body limit, so routes with a body limit reject a declared oversized `Content-Length` with 413 without reading the body, and read chunked bodies only up to the limit before responding 413. Custom API routes have no Mastra body limit: their `requestContext` lookup stops at the server-wide `bodySizeLimit`, and a larger body is ignored for context extraction rather than rejected. `@mastra/next` and `@mastra/tanstack-start` get the fix through `@mastra/hono`.
