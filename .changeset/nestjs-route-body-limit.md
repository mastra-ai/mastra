---
'@mastra/nestjs': patch
---

Fixed the NestJS adapter ignoring per-route body size limits on JSON requests. Routes like the observability query endpoints now return 413 for bodies over their limit, the same as the other adapters.
