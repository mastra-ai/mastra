---
'@mastra/nestjs': patch
---

Added support for NestJS v12. `@mastra/nestjs` now accepts `@nestjs/common` and `@nestjs/core` v12 as peer dependencies, so installing it in a NestJS v12 app no longer fails with a peer dependency conflict. Fixes [#25077](https://github.com/mastra-ai/mastra/issues/25077).
