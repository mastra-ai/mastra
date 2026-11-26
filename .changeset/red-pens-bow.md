---
'@mastra/factory': patch
---

Added an on-demand heap snapshot download at `GET /web/admin/heap-snapshot`, so you can find what a Factory process is holding in memory without shell access. It is off by default: set `FACTORY_HEAP_SNAPSHOT=1` (or `true`), and in tenant mode the caller must be an organization administrator. The snapshot contains every secret in the process, including other users' credentials, so only enable it on a single-tenant deployment you operate. One snapshot runs at a time; a second concurrent request returns 409.
