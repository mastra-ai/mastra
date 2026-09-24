---
'@mastra/koa': patch
---

Handler errors with status 501 Not Implemented are no longer printed again by Koa's default error listener with `console.error`. Custom `app.on('error')` listeners still receive them.
