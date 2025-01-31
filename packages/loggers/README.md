# @mastra/loggers

A collection of logging transport implementations for Mastra, extending the `LoggerTransport` class from `@mastra/core`.

## Installation

```bash
npm install @mastra/loggers
```

## Available Transports

### File Transport

A transport that writes logs to a local file system.

```typescript
import { FileTransport } from '@mastra/loggers';

const fileLogger = new FileTransport({
  path: '/path/to/logs/app.log',
});
```

#### Configuration

- `path`: Absolute path to the log file (must exist)

#### Features

- Append-mode logging
- Automatic stream cleanup
- JSON log parsing
- Query logs by run ID
- Stream-based implementation

### Upstash Transport

A transport that sends logs to Upstash Redis with batching and auto-trimming capabilities.

```typescript
import { UpstashTransport } from '@mastra/loggers';

const upstashLogger = new UpstashTransport({
  upstashUrl: 'https://your-instance.upstash.io',
  upstashToken: 'your-token',
  listName: 'application-logs', // optional
  maxListLength: 10000, // optional
  batchSize: 100, // optional
  flushInterval: 10000, // optional
});
```

#### Configuration

Required:

- `upstashUrl`: Your Upstash Redis instance URL
- `upstashToken`: Your Upstash authentication token

Optional:

- `listName`: Redis list name for logs (default: 'application-logs')
- `maxListLength`: Maximum number of logs to keep (default: 10000)
- `batchSize`: Number of logs to send in one batch (default: 100)
- `flushInterval`: Milliseconds between flush attempts (default: 10000)

#### Features

- Batched log writing
- Automatic log rotation (LTRIM)
- Configurable buffer size
- Automatic retry on failure
- Query logs by run ID
- JSON log formatting
- Timestamp auto-injection
- Graceful shutdown with final flush

## Usage with Mastra Core

Both transports implement the `LoggerTransport` interface from `@mastra/core`:

```typescript
import { Logger } from '@mastra/core/logger';
import { FileTransport, UpstashTransport } from '@mastra/loggers';

// Create transports
const fileTransport = new FileTransport({
  path: '/var/log/app.log',
});

const upstashTransport = new UpstashTransport({
  upstashUrl: process.env.UPSTASH_URL!,
  upstashToken: process.env.UPSTASH_TOKEN!,
});

// Create logger with multiple transports
const logger = new Logger({
  transports: [fileTransport, upstashTransport],
});

// Log messages
logger.info('Hello world', { metadata: 'value' });

// Query logs
const allLogs = await fileTransport.getLogs();
const runLogs = await upstashTransport.getLogsByRunId({ runId: 'abc-123' });
```

## Log Message Format

Both transports handle log messages in JSON format with the following structure:

```typescript
interface BaseLogMessage {
  time?: number; // Timestamp (auto-injected if not present)
  level?: string; // Log level
  msg?: {
    // Message content
    runId?: string; // Optional run ID for grouping logs
    [key: string]: any;
  };
  [key: string]: any;
}
```

## Error Handling

Both transports include robust error handling:

- File Transport:

  - Validates file path existence
  - Handles stream errors
  - Graceful cleanup on destroy

- Upstash Transport:
  - Validates required configuration
  - Retries failed batches
  - Buffers logs during outages
  - Graceful shutdown with final flush

## Related Links

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Node.js Stream Documentation](https://nodejs.org/api/stream.html)
