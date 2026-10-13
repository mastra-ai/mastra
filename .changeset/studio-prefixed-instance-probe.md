---
'mastra': patch
---

Fixed Studio failing to auto-connect when Mastra is mounted under a prefix in a host app (for example with `@mastra/next`, `@mastra/hono` or `@mastra/tanstack-start`). Studio now checks the server through `<server-api-prefix>/auth/capabilities` instead of the server root, so `mastra studio --server-api-prefix /api/mastra` connects even when the host app's root returns 401 or redirects.
