# @mastra/nestjs

NestJS server adapter for Mastra, enabling you to run Mastra with the [NestJS](https://nestjs.com) framework. Supports both Express and Fastify platforms.

## Installation

```bash
npm install @mastra/nestjs @nestjs/common @nestjs/core
```

For Express platform (default):

```bash
npm install @nestjs/platform-express express
```

For Fastify platform:

```bash
npm install @nestjs/platform-fastify fastify
```

## Usage

### Express Platform (Default)

```typescript
import { NestFactory } from '@nestjs/core';
import { MastraServer } from '@mastra/nestjs';
import { AppModule } from './app.module';
import { mastra } from './mastra';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const server = new MastraServer({ app, mastra });
  await server.init();

  await app.listen(3000);
}
bootstrap();
```

### Fastify Platform

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { MastraServer } from '@mastra/nestjs';
import { AppModule } from './app.module';
import { mastra } from './mastra';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const server = new MastraServer({ app, mastra });
  await server.init();

  // For Fastify, listen on all interfaces
  await app.listen(3000, '0.0.0.0');
}
bootstrap();
```

## Platform Detection

The adapter automatically detects which platform NestJS is using:

```typescript
const server = new MastraServer({ app, mastra });
console.log(server.getPlatformType()); // 'express' or 'fastify'
```

## Configuration Options

```typescript
const server = new MastraServer({
  app,
  mastra,
  prefix: '/api/v2', // Route prefix
  openapiPath: '/openapi.json', // OpenAPI spec endpoint
  bodyLimitOptions: {
    maxSize: 10 * 1024 * 1024, // 10MB
    onError: err => ({ error: 'Payload too large' }),
  },
  streamOptions: { redact: true }, // Redact sensitive data from streams
  tools: {}, // Additional tools
  taskStore: taskStore, // Task store instance
  customRouteAuthConfig: authConfig, // Custom auth configuration
});
```

## Adding Custom Routes

### Express Platform

Access Mastra context via `res.locals`:

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get('health')
  health(@Res() res: Response) {
    const mastraInstance = res.locals.mastra;
    const agents = Object.keys(mastraInstance.listAgents());
    return res.json({ status: 'ok', agents });
  }
}
```

### Fastify Platform

Access Mastra context via request object:

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Controller()
export class AppController {
  @Get('health')
  health(@Req() req: FastifyRequest) {
    const mastraInstance = (req as any).mastra;
    const agents = Object.keys(mastraInstance.listAgents());
    return { status: 'ok', agents };
  }
}
```

## Context Variables

### Express (via `res.locals`)

| Key                     | Description                 |
| ----------------------- | --------------------------- |
| `mastra`                | Mastra instance             |
| `requestContext`        | Request context map         |
| `abortSignal`           | Request cancellation signal |
| `tools`                 | Available tools             |
| `taskStore`             | Task store instance         |
| `customRouteAuthConfig` | Auth configuration          |

### Fastify (via `request`)

| Key                     | Description                 |
| ----------------------- | --------------------------- |
| `mastra`                | Mastra instance             |
| `requestContext`        | Request context map         |
| `abortSignal`           | Request cancellation signal |
| `tools`                 | Available tools             |
| `taskStore`             | Task store instance         |
| `customRouteAuthConfig` | Auth configuration          |

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/deployment/server)
- [NestJS Documentation](https://docs.nestjs.com)
- [Express Adapter](https://www.npmjs.com/package/@mastra/express)
- [Fastify Adapter](https://www.npmjs.com/package/@mastra/fastify)
