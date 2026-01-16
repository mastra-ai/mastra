# @mastra/nestjs

## 0.1.0-beta.1

### Minor Changes

- Initial release of the NestJS server adapter for Mastra

  **Features:**
  - Dual-platform support for both Express and Fastify NestJS platforms
  - Automatic platform detection based on NestJS HTTP adapter
  - Full compatibility with Mastra server routes and handlers
  - Stream support with optional data redaction
  - Multipart form data handling
  - MCP (Model Context Protocol) HTTP and SSE transport support
  - Authentication and authorization middleware for both platforms
  - Request context propagation
  - Abort signal support for request cancellation

  **Usage with Express (default):**

  ```typescript
  import { NestFactory } from '@nestjs/core';
  import { MastraServer } from '@mastra/nestjs';
  import { AppModule } from './app.module';
  import { mastra } from './mastra';

  const app = await NestFactory.create(AppModule);
  const server = new MastraServer({ app, mastra });
  await server.init();
  await app.listen(3000);
  ```

  **Usage with Fastify:**

  ```typescript
  import { NestFactory } from '@nestjs/core';
  import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
  import { MastraServer } from '@mastra/nestjs';
  import { AppModule } from './app.module';
  import { mastra } from './mastra';

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const server = new MastraServer({ app, mastra });
  await server.init();
  await app.listen(3000, '0.0.0.0');
  ```
