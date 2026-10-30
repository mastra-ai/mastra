---
'@mastra/koa': patch
---

Koa still emits 4xx errors and 501 Not Implemented errors to every `error` listener your app registers, including a custom `app.onerror` and listeners added after `listen()`. Koa's built-in listener no longer prints them to `console.error`: the emit is skipped when it's the only listener, and otherwise the error is marked `expose` so it returns early. 5xx errors are handled as before.
