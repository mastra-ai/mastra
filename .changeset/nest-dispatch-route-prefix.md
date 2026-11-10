---
'@mastra/nestjs': patch
---

Routes run in-process with `dispatchRoute` now apply your `server.auth` rules to the paths the NestJS module really serves, including a custom `prefix` passed to `MastraModule.register`.

Routes dispatched from a request the module served get that module's paths, even when another adapter serves the same `Mastra` instance.
