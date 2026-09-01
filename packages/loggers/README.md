# @mastra/loggers

Utilities for using @mastra/loggers with Mastra. Install `@mastra/loggers` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/loggers
```

## Usage

Create a logger and pass it to your Mastra configuration.

```typescript
import { PinoLogger } from '@mastra/loggers';

const logger = new PinoLogger({ name: 'mastra', level: 'info' });
```

## Documentation

- [@mastra/loggers documentation](https://mastra.ai/reference/logging/pino-logger)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/loggers/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
