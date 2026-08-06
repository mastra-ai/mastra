---
'mastra': patch
---

Fixed `mastra api --url` returning 401 when pointed at a Mastra Cloud Studio or Factory instance. The CLI now uses your logged-in credentials to authenticate requests to `*.studio.mastra.cloud` and `*.factory.mastra.cloud` (and the corresponding staging domains). User-hosted `*.server.mastra.cloud` URLs and custom URLs are unchanged, and an explicit `--header Authorization: ...` always wins.
