---
'@mastra/nestjs': patch
---

Routes run in-process with `dispatchRoute` now apply your `server.auth` rules to the paths the NestJS module really serves, including a custom `prefix` passed to `MastraModule.register`.
