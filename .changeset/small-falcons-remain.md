---
'@mastra/server': patch
---

Custom API routes now validate that their paths don't collide with the built-in route prefix. If a custom route path starts with the server's `apiPrefix` (default `/api`), a descriptive error is thrown at startup. This prevents custom routes from shadowing built-in Mastra routes (e.g. `/api/agents`, `/api/tools`).
