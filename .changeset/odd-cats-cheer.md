---
'@mastra/tanstack-start': minor
---

Added a new TanStack Start server adapter package for Mastra.

It provides a `MastraServer` wrapper around the Hono adapter with `createRequestHandler()` and `createRouteHandlers()` helpers so TanStack Start catch-all server routes can forward requests to Mastra with minimal setup.
