---
'@mastra/koa': patch
---

Koa still emits 4xx errors and 501 Not Implemented errors to every `error` listener your app registers, including a custom `app.onerror` and listeners added after `listen()`. These errors are marked `expose`, so Koa's built-in listener is still called but returns early instead of printing them to `console.error`. 5xx errors are handled as before.
