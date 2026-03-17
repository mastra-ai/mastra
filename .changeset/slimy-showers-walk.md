---
'@mastra/core': patch
---

Fixed type inference for requestContext schemas when using Zod v3 and v4. Agent and tool configurations now correctly infer RequestContext types from Zod schemas and other StandardSchema-compatible schemas.
