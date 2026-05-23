---
'@mastra/koa': patch
---

Koa route handlers now receive `getHeader`, `requestBody`, and `requestPathParams`, and HTTP logs redact sensitive query parameters.
