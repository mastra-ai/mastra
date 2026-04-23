---
'@mastra/fastify': patch
---

Fix custom route handlers on the Fastify adapter silently overwriting request-body fields named `tools` (e.g. `POST /stored/agents`, `POST /stored/workspaces`). The adapter now exposes registered tools as `registeredTools` in handler params, matching the Express and Hono adapters and the `@mastra/server` handler contract.
