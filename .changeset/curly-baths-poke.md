---
'@mastra/nestjs': minor
---

Added NestJS server adapter with support for both Express and Fastify platforms.

The new `@mastra/nestjs` package enables running Mastra within NestJS applications. Key features:

- **Automatic platform detection**: Detects whether NestJS is using Express or Fastify and configures accordingly
- **Full Mastra API support**: All standard Mastra server routes for agents, workflows, memory, and tools
- **Stream support**: SSE streaming with optional sensitive data redaction
- **MCP transport**: Model Context Protocol support for both HTTP and SSE
- **Authentication middleware**: Platform-specific auth middleware for both Express and Fastify

**Usage with Express (default):**

```typescript
import { NestFactory } from '@nestjs/core';
import { MastraServer } from '@mastra/nestjs';

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

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
const server = new MastraServer({ app, mastra });
await server.init();
await app.listen(3000, '0.0.0.0');
```
