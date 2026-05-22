---
'mastracode': patch
---

Route Unix socket signal PubSub traffic through per-thread socket paths under `/tmp/mc/<resourceId>/<threadId>.sock` and guard concurrent socket initialization.
