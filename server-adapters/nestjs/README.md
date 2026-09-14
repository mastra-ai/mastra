# @mastra/nestjs

NestJS server adapter for [Mastra](https://mastra.ai). Use it to expose agents, workflows, tools, MCP, memory, voice, and streaming endpoints through NestJS with native dependency injection, guards, interceptors, and exception handling.

The adapter supports NestJS running on the Express platform. If an application uses the Fastify platform, `MastraModule` fails during bootstrap instead of partially initializing.

## Installation

```bash
npm install @mastra/nestjs
```

## Usage

Register `MastraModule` in the application module. Import it after modules with application routes so its catch-all controller does not intercept them first.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { MastraModule } from '@mastra/nestjs';
import { mastra } from './mastra';

@Module({
  imports: [
    MastraModule.register({
      mastra,
      prefix: '/api/mastra',
    }),
  ],
})
export class AppModule {}
```

```typescript title="src/main.ts"
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

## Documentation

`MastraModule.register()` accepts the Mastra instance and optional settings for the route prefix, rate limits, graceful shutdown, request body limits, stream heartbeat and redaction, tracing, request context parsing, tools, MCP transport, authentication, and per-route auth overrides.

The module registers Mastra routes under `/api` by default. Because it uses a catch-all NestJS controller, either import `MastraModule` last or assign a dedicated prefix such as `/api/mastra`.

- [NestJS adapter reference](https://mastra.ai/reference/server/nestjs-adapter)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/nestjs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
