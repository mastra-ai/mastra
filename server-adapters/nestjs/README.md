# @mastra/nestjs

NestJS server adapter for [Mastra](https://mastra.ai). Use it to expose agents, workflows, tools, MCP, and streaming endpoints through NestJS with native guards, interceptors, and DI.

This package supports NestJS running on the Express adapter only. If your app uses Fastify, `MastraModule` now fails fast during bootstrap with a clear error instead of partially initializing.

## Installation

```bash
npm install @mastra/nestjs
```

## Usage

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

## Documentation

- [@mastra/nestjs documentation](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/nestjs/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
