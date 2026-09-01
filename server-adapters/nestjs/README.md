# @mastra/nestjs

Mastra NestJS adapter for the server. Use `@mastra/nestjs` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/nestjs
```

## Usage

Configure the prerequisites described in the documentation.

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
