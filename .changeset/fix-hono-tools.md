---
'@mastra/fastify': patch
---

Expose `registeredTools` (instead of `tools`) in handler params to align with the Express and Hono adapters. The previous `tools` key collided with request body fields named `tools` (e.g. on stored-agent and stored-workspace routes), which could overwrite user-supplied tool definitions. Handlers in `@mastra/server` already consume `registeredTools`, so this also restores consistent behavior across adapters.
