---
'@mastra/server': patch
---

fix(server): Strip reserved context keys from client-provided requestContext

Clients could inject `mastra__resourceId` or `mastra__threadId` via the request body or query params to impersonate other users' memory/thread access. Reserved keys are now filtered out during request context creation in `mergeRequestContext`, so only server-side code (auth callbacks, middleware) can set them.
