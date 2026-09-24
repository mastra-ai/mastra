---
'@mastra/koa': patch
---

Fixed duplicate `console.error` output for handler errors with status 501 Not Implemented on Koa. Custom `app.on('error')` listeners still receive these errors.
