---
'@mastra/fastify': patch
---

Fixed validation error responses on routes with `bodySchema`, `queryParamSchema`, or `pathParamSchema` losing field path information when consumers pin `zod@^3`. Responses now return the actual field name in `issues[].field` (e.g. `"agent_id"`) instead of `"unknown"` with the zod issues blob stuffed into `issues[0].message`. Fixes [#17167](https://github.com/mastra-ai/mastra/issues/17167).
