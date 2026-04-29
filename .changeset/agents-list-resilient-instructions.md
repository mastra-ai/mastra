---
'@mastra/server': patch
---

Fixed `GET /agents` returning 500 when one agent throws while resolving dynamic configuration under the active request context.
The route now still returns the rest of the agent list and falls back to safe defaults for the failing agent instead of failing the whole response.
