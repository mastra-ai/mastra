---
'@mastra/hono': patch
---

Fixed DELETE requests with JSON bodies not being parsed. Now parses request bodies for DELETE methods (previously only POST, PUT, PATCH).
