# @mastra/koa

## 0.1.0-beta.16

### Patch Changes

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`92854c5`](https://github.com/mastra-ai/mastra/commit/92854c581618694f76ca1ee9873f9a10121d03e8), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`92854c5`](https://github.com/mastra-ai/mastra/commit/92854c581618694f76ca1ee9873f9a10121d03e8), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21
  - @mastra/server@1.0.0-beta.21

## 0.1.0-beta.15

### Minor Changes

- feat: Add Fastify and Koa server adapters ([#11568](https://github.com/mastra-ai/mastra/pull/11568))

  Introduces two new server adapters for Mastra:
  - **@mastra/fastify**: Enables running Mastra applications on Fastify
  - **@mastra/koa**: Enables running Mastra applications on Koa

  Both adapters provide full MastraServerBase implementation including route registration, streaming responses, multipart uploads, auth middleware, and MCP transport support.

  ## Usage

  ### Fastify

  ```typescript
  import Fastify from 'fastify';
  import { MastraServer } from '@mastra/fastify';
  import { mastra } from './mastra';

  const app = Fastify();
  const server = new MastraServer({ app, mastra });

  await server.init();

  app.listen({ port: 4111 });
  ```

  ### Koa

  ```typescript
  import Koa from 'koa';
  import bodyParser from 'koa-bodyparser';
  import { MastraServer } from '@mastra/koa';
  import { mastra } from './mastra';

  const app = new Koa();
  app.use(bodyParser());

  const server = new MastraServer({ app, mastra });

  await server.init();

  app.listen(4111);
  ```

### Patch Changes

- Fixed inconsistent query parameter handling across server adapters. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). Added internal helper `normalizeQueryParams` and `ParsedRequestParams` type to `@mastra/server` for adapter implementations.

  **Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

  **User impact:** None for typical usage - HTTP endpoints and client SDK behavior are unchanged. If you extend server adapter classes and override `getParams` or `parseQueryParams`, update your implementation to use `Record<string, string | string[]>` for query parameters.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`106c960`](https://github.com/mastra-ai/mastra/commit/106c960df5d110ec15ac8f45de8858597fb90ad5), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20
  - @mastra/server@1.0.0-beta.20

## 0.1.0-beta.14

### Minor Changes

- Initial release of Koa server adapter for Mastra
