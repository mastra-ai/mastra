# @mastra/loggers

`@mastra/loggers` provides production logging implementations for Mastra, including the Pino-based `PinoLogger`. Use it to control structured output, log levels, redaction, custom levels, and destination-specific formatting for a Mastra application.

## Installation

```bash
npm install @mastra/loggers
```

## Usage

Create a logger and pass it to your Mastra configuration.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

const logger = new PinoLogger({ name: 'mastra', level: 'info' });

export const mastra = new Mastra({ logger });
```

## Documentation

- [@mastra/loggers documentation](https://mastra.ai/reference/logging/pino-logger)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/loggers/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
