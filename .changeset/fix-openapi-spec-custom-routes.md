---
'@mastra/server': patch
---

Fixed OpenAPI spec for custom route paths. Custom routes registered via `registerApiRoute` are served at the root path (e.g. `/health`), not under `/api`. The OpenAPI spec now correctly represents this so that API tools and clients using the spec will resolve them to the correct URL.
