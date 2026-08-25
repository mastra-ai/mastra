# @mastra/elysia

## 0.1.0-alpha.0

### Minor Changes

- Added an Elysia server adapter. Use the new @mastra/elysia package to run a Mastra server inside an Elysia app. ([#22274](https://github.com/mastra-ai/mastra/pull/22274))

  ```typescript
  import { Elysia } from 'elysia';
  import { MastraServer } from '@mastra/elysia';
  import { mastra } from './mastra';

  const app = new Elysia();
  const server = new MastraServer({ app, mastra });

  await server.init();

  app.listen(4111);
  ```

### Patch Changes

- Added the `convertCustomRoutesToOpenAPIPaths` export to `@mastra/server/server-adapter` so server adapters can include custom API routes in generated OpenAPI documents. ([#22274](https://github.com/mastra-ai/mastra/pull/22274))

- Updated dependencies [[`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`2848a9f`](https://github.com/mastra-ai/mastra/commit/2848a9f4c89fa03c34e94793929d14640117d5f6), [`2848a9f`](https://github.com/mastra-ai/mastra/commit/2848a9f4c89fa03c34e94793929d14640117d5f6)]:
  - @mastra/core@1.62.0-alpha.10
  - @mastra/server@1.62.0-alpha.10
