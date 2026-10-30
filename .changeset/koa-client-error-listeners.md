---
'@mastra/koa': patch
---

Koa no longer prints 4xx errors or 501 Not Implemented errors to `console.error`. Error listeners your app registers still receive them, including `app.on('error')` listeners, a custom `app.onerror`, and `errorMonitor` listeners. 5xx errors are handled as before.
