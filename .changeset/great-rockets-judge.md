---
'@mastra/server': patch
---

Fixed dataset item endpoints to return HTTP 400 when payloads contain circular values that cannot be serialized.
