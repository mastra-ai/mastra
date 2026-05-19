---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Updated the adapter permission check to read user permissions from the new namespaced request-context key `mastra__userPermissions` (was `userPermissions`). This matches the namespaced keys that `@mastra/server`'s core auth middleware now writes and avoids collisions with caller-supplied context entries.

No action needed for typical users — install the matching `@mastra/server` release and the adapter will continue to enforce route permissions exactly as before.
