# @mastra/elysia

## 0.1.0-alpha.2

### Patch Changes

- Updated dependencies [[`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd)]:
  - @mastra/core@1.62.0-alpha.12
  - @mastra/server@1.62.0-alpha.12

## 0.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8)]:
  - @mastra/core@1.62.0-alpha.11
  - @mastra/server@1.62.0-alpha.11

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
