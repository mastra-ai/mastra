---
'@mastra/server': patch
---

Fixed dataset item endpoints to return HTTP 400 when payloads contain circular values or silently lossy JSON values (nested `undefined`, functions, symbols, bigints, and non-finite numbers) that cannot be serialized faithfully.
