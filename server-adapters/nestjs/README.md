# @mastra/nestjs

NestJS server adapter for [Mastra](https://mastra.ai). Use it to expose agents, workflows, tools, MCP, and streaming endpoints through NestJS with native guards, interceptors, and DI.

## Features

- **NestJS-native integration** via modules, DI, guards, interceptors, and filters
- **Rate limiting** enabled by default (opt-out)
- **Graceful shutdown** with in-flight request tracking and optional SSE notifications
- **Streaming** for AI responses with optional redaction and SSE heartbeats
- **MCP transport** (HTTP + SSE) exposed under the API prefix

## Installation

```bash
npm install @mastra/nestjs @mastra/core
# or
pnpm add @mastra/nestjs @mastra/core
# or
yarn add @mastra/nestjs @mastra/core
```

## Quick Start

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MastraModule } from '@mastra/nestjs';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';

/** Simple tool used by the demo agent. */
const pingTool = createTool({
  id: 'ping',
  description: 'Returns a pong response',
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }) => ({ ok: true, message }),
});

/** Minimal Mastra instance for NestJS integration. */
const mastra = new Mastra({
  tools: { ping: pingTool },
  agents: {
    greeter: {
      name: 'greeter',
      description: 'Greets the user and can call tools.',
      model: 'openai/gpt-4o-mini',
      tools: ['ping'],
    },
  },
});

@Module({
  imports: [MastraModule.register({ mastra })],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

With the default prefix (`/api`), Mastra routes mount under `http://localhost:3000/api`.

## Async Module Registration

Use async registration when the Mastra config depends on runtime services (e.g., `ConfigService`).

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MastraModule } from '@mastra/nestjs';
import { Mastra } from '@mastra/core/mastra';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MastraModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        mastra: new Mastra({
          agents: {
            greeter: {
              name: 'greeter',
              description: 'Greets users with a short response.',
              model: config.get('MASTRA_MODEL', 'openai/gpt-4o-mini'),
            },
          },
        }),
        prefix: config.get('MASTRA_PREFIX', '/api'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Injecting Mastra in Services

Use `MASTRA` for direct access or `MastraService` for helper methods.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { MASTRA, MastraService } from '@mastra/nestjs';
import type { Mastra } from '@mastra/core/mastra';

@Injectable()
export class AgentService {
  constructor(@Inject(MASTRA) private readonly mastra: Mastra) {}

  async greet() {
    const agent = this.mastra.getAgent('greeter');
    return agent.generate({
      messages: [{ role: 'user', content: 'Hello from NestJS' }],
    });
  }
}

@Injectable()
export class WorkflowService {
  constructor(private readonly mastraService: MastraService) {}

  async runWorkflow(workflowId: string, inputData: Record<string, unknown>) {
    const workflow = this.mastraService.getWorkflow(workflowId);
    return workflow.start({ inputData });
  }
}
```

## Request Context (GET + POST)

Pass request context via query string or JSON body. The adapter accepts JSON or base64-encoded JSON.

```bash
curl "http://localhost:3000/api/agents/greeter/generate?requestContext=%7B%22userId%22%3A%22123%22%7D"
```

```bash
curl -X POST "http://localhost:3000/api/agents/greeter/generate" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}],"requestContext":{"userId":"123"}}'
```

## Rate Limiting

Rate limiting is on by default. Disable it or customize limits:

```typescript
MastraModule.register({
  mastra,
  rateLimitOptions: {
    enabled: true,
    defaultLimit: 200,
    generateLimit: 20,
    windowMs: 60_000,
  },
});
```

## Streaming Options

```typescript
MastraModule.register({
  mastra,
  streamOptions: {
    redact: true,
    heartbeatMs: 20_000,
  },
});
```

## MCP Transport (HTTP + SSE)

MCP endpoints are exposed under the API prefix:

- `POST /api/mcp/:serverId/mcp`
- `GET /api/mcp/:serverId/sse`
- `POST /api/mcp/:serverId/messages`

## Health Endpoints

These are always at the root (not under the prefix):

- `GET /health`
- `GET /ready`
- `GET /info`

## Decorators

Skip auth or rate limiting on specific controller routes:

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Public, SkipThrottle, MastraThrottle } from '@mastra/nestjs';

@Controller('custom')
export class CustomController {
  @Get('public')
  @Public()
  publicRoute() {}

  @Get('unlimited')
  @SkipThrottle()
  unlimitedRoute() {}

  @Post('custom-limit')
  @MastraThrottle({ limit: 5, windowMs: 60_000 })
  customLimitRoute() {}
}
```

## Configuration Options

| Option                              | Type                                          | Default              | Description                                 |
| ----------------------------------- | --------------------------------------------- | -------------------- | ------------------------------------------- |
| `mastra`                            | `Mastra`                                      | required             | The Mastra instance                         |
| `prefix`                            | `string`                                      | `/api`               | Route prefix                                |
| `rateLimitOptions`                  | `object`                                      | enabled              | Rate limiting configuration                 |
| `rateLimitOptions.enabled`          | `boolean`                                     | `true`               | Enable/disable rate limiting                |
| `rateLimitOptions.defaultLimit`     | `number`                                      | `100`                | Requests per window                         |
| `rateLimitOptions.generateLimit`    | `number`                                      | `10`                 | Stricter limit for `/generate`              |
| `rateLimitOptions.windowMs`         | `number`                                      | `60000`              | Window size in ms                           |
| `shutdownOptions`                   | `object`                                      | -                    | Graceful shutdown configuration             |
| `shutdownOptions.timeoutMs`         | `number`                                      | `30000`              | Max wait time for in-flight requests        |
| `shutdownOptions.notifyClients`     | `boolean`                                     | `true`               | Send shutdown event to SSE clients          |
| `bodyLimitOptions`                  | `object`                                      | -                    | Request body size limits                    |
| `bodyLimitOptions.maxSize`          | `number`                                      | `10MB`               | Max JSON body size                          |
| `bodyLimitOptions.maxFileSize`      | `number`                                      | -                    | Max multipart file size (no limit if unset) |
| `bodyLimitOptions.allowedMimeTypes` | `string[]`                                    | -                    | Allowed upload MIME types                   |
| `streamOptions`                     | `{ redact?: boolean; heartbeatMs?: number }`  | -                    | Streaming config                            |
| `tracingOptions`                    | `{ enabled?: boolean; serviceName?: string }` | -                    | OpenTelemetry tracing                       |
| `customRouteAuthConfig`             | `Map<string, boolean>`                        | -                    | Per-route auth overrides                    |
| `mcpOptions`                        | `object`                                      | -                    | MCP transport options                       |
| `mcpOptions.serverless`             | `boolean`                                     | `false`              | Stateless MCP HTTP mode                     |
| `mcpOptions.sessionIdGenerator`     | `() => string`                                | -                    | Custom MCP session IDs                      |
| `auth`                              | `{ enabled?: boolean }`                       | `{ enabled: false }` | Enable Mastra's built-in token auth         |

## Requirements

- Node.js >= 22.13.0
- NestJS with Express adapter (`@nestjs/platform-express`)
- Express 4.x or 5.x

**Note:** This adapter supports NestJS with Express only. Fastify support is planned for v2.

## API Reference

### `MastraModule.register(options)`

Register Mastra with NestJS DI.

### `MastraModule.registerAsync(options)`

Async registration supporting `useFactory`, `useClass`, and `useExisting`.

### `MastraService`

```typescript
class MastraService {
  getMastra(): Mastra;
  getOptions(): MastraModuleOptions;
  getAgent(agentId: string): Agent;
  getWorkflow(workflowId: string): Workflow;
  isShuttingDown: boolean;
}
```

### `MASTRA`

Injection token for the Mastra instance.

## Exported Components

```typescript
import {
  MastraAuthGuard,
  MastraThrottleGuard,
  StreamingInterceptor,
  RequestTrackingInterceptor,
  MastraExceptionFilter,
  RouteHandlerService,
  RequestContextService,
  ShutdownService,
} from '@mastra/nestjs';
```

## Related Packages

- [@mastra/core](https://www.npmjs.com/package/@mastra/core)
- [@mastra/express](https://www.npmjs.com/package/@mastra/express)
- [@mastra/hono](https://www.npmjs.com/package/@mastra/hono)

## License

Apache-2.0
