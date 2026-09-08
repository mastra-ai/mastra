# @mastra/loggers

Logger and logging transport implementations for Mastra. The package includes a structured Pino logger plus file, HTTP, and Upstash transports that extend `LoggerTransport` from `@mastra/core/logger`.

## Installation

```bash
npm install @mastra/loggers
```

## Usage

Create a logger with one or more named transports and pass it to Mastra:

```typescript
import { Logger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { FileTransport } from '@mastra/loggers/file';
import { UpstashTransport } from '@mastra/loggers/upstash';

const logger = new Logger({
  transports: [
    new FileTransport({ path: '/var/log/my-app.log' }),
    new UpstashTransport({
      upstashUrl: process.env.UPSTASH_URL!,
      upstashToken: process.env.UPSTASH_TOKEN!,
    }),
  ],
});

export const mastra = new Mastra({ logger });
```

## Documentation

### Logger

`Logger` combines one or more `LoggerTransport` implementations and can be passed directly to the Mastra configuration. It supports standard log levels and sends each structured log record to the configured transports, which can persist, batch, or forward the data to external systems.

### File transport

`FileTransport` appends structured logs to an existing local file. It can list logs, query by run ID, stream records, and clean up the underlying write stream when destroyed.

```typescript
import { FileTransport } from '@mastra/loggers/file';

const fileTransport = new FileTransport({ path: '/var/log/my-app.log' });
const runLogs = await fileTransport.listLogsByRunId({ runId: 'run-123' });
```

### Upstash transport

`UpstashTransport` batches logs into an Upstash Redis list. Configure the instance URL and token, then optionally set the list name, maximum retained list length, batch size, and flush interval. It trims old records, retries failed batches, and performs a final flush during shutdown.

```typescript
import { UpstashTransport } from '@mastra/loggers/upstash';

const upstashTransport = new UpstashTransport({
  upstashUrl: process.env.UPSTASH_URL!,
  upstashToken: process.env.UPSTASH_TOKEN!,
  listName: 'application-logs',
  maxListLength: 10_000,
  batchSize: 100,
  flushInterval: 10_000,
});
```

### HTTP transport

`HttpTransport` sends batches of structured log records to an HTTP endpoint and supports request headers, batching, retry, and flush configuration. Use it for application-specific collectors and hosted logging gateways.

- [`PinoLogger` reference](https://mastra.ai/reference/logging/pino-logger)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/loggers/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
