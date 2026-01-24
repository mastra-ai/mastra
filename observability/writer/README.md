# @mastra/observability-writer

Observability event writer for MastraAdmin. Batches and writes traces, spans, logs, metrics, and scores to file storage as JSONL files.

## Installation

```bash
npm install @mastra/observability-writer
```

## Prerequisites

- Node.js >= 22.13.0
- A `FileStorageProvider` implementation (e.g., `@mastra/observability-file-local`)

## Usage

### Basic Configuration

```typescript
import { ObservabilityWriter } from '@mastra/observability-writer';
import { LocalFileStorage } from '@mastra/observability-file-local';

const writer = new ObservabilityWriter({
  fileStorage: new LocalFileStorage({ basePath: '/var/mastra/observability' }),
  projectId: 'proj_123',
});

// Record events
writer.recordTrace({
  id: 'trace_1',
  projectId: 'proj_123',
  name: 'agent-execution',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  status: 'ok',
});

writer.recordSpan({
  id: 'span_1',
  traceId: 'trace_1',
  projectId: 'proj_123',
  name: 'llm-call',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  status: 'ok',
});

writer.recordLog({
  id: 'log_1',
  projectId: 'proj_123',
  level: 'info',
  message: 'Agent completed successfully',
  timestamp: new Date().toISOString(),
});

// Graceful shutdown (flushes remaining events)
await writer.shutdown();
```

### Advanced Configuration

```typescript
const writer = new ObservabilityWriter({
  fileStorage,
  projectId: 'proj_123',

  // Buffer up to 500 events before flushing
  batchSize: 500,

  // Flush every 10 seconds regardless of batch size
  flushIntervalMs: 10000,

  // Start a new file after 5MB
  maxFileSize: 5 * 1024 * 1024,

  // Custom base path for files
  basePath: 'custom/observability',

  // Enable debug logging
  debug: true,
});
```

### Recording Multiple Events

```typescript
writer.recordEvents([
  { type: 'trace', id: 't1', projectId: 'p1', ... },
  { type: 'span', id: 's1', traceId: 't1', projectId: 'p1', ... },
  { type: 'log', id: 'l1', projectId: 'p1', ... },
]);
```

### Manual Flush

```typescript
// Force flush all buffered events
const result = await writer.flush();
console.log(`Flushed ${result.eventsWritten} events to ${result.filesWritten} files`);
```

### Monitoring Statistics

```typescript
const stats = writer.getStats();
console.log('Events buffered:', stats.totalEventsBuffered);
console.log('Events written:', stats.totalEventsWritten);
console.log('Files written:', stats.totalFilesWritten);
console.log('Last flush:', stats.lastFlushAt);
```

## File Format

Events are written as JSONL (JSON Lines) files:

```
{"type":"trace","id":"trace_1","projectId":"proj_123",...,"recordedAt":"2025-01-23T12:00:00.000Z"}
{"type":"trace","id":"trace_2","projectId":"proj_123",...,"recordedAt":"2025-01-23T12:00:01.000Z"}
```

### File Naming Convention

Files are organized by event type and project:

```
{basePath}/{type}/{projectId}/{timestamp}_{uuid}.jsonl
```

Example:

```
observability/traces/proj_123/20250123T120000Z_abc123def456.jsonl
observability/spans/proj_123/20250123T120500Z_789xyz000111.jsonl
```

## API Reference

### ObservabilityWriter

#### Constructor

```typescript
new ObservabilityWriter(config: ObservabilityWriterConfig)
```

#### Methods

| Method                 | Description                       |
| ---------------------- | --------------------------------- |
| `recordTrace(trace)`   | Record a trace event              |
| `recordSpan(span)`     | Record a span event               |
| `recordLog(log)`       | Record a log event                |
| `recordMetric(metric)` | Record a metric event             |
| `recordScore(score)`   | Record a score event              |
| `recordEvents(events)` | Record multiple events            |
| `flush()`              | Force flush all buffered events   |
| `shutdown()`           | Gracefully shutdown the writer    |
| `getStats()`           | Get current writer statistics     |
| `isShutdown()`         | Check if writer has been shutdown |
| `getProjectId()`       | Get the configured project ID     |

### Configuration Options

| Option            | Type                  | Default         | Description                              |
| ----------------- | --------------------- | --------------- | ---------------------------------------- |
| `fileStorage`     | `FileStorageProvider` | required        | Storage provider for writing files       |
| `projectId`       | `string`              | required        | Project identifier for file organization |
| `batchSize`       | `number`              | 1000            | Max events to buffer before flushing     |
| `flushIntervalMs` | `number`              | 5000            | Max time between flushes (ms)            |
| `maxFileSize`     | `number`              | 10MB            | Max file size before rotation            |
| `basePath`        | `string`              | 'observability' | Base path for files                      |
| `debug`           | `boolean`             | false           | Enable debug logging                     |

## Related Packages

- `@mastra/admin` - Core types and interfaces
- `@mastra/observability-file-local` - Local filesystem storage
- `@mastra/observability-file-s3` - Amazon S3 storage
- `@mastra/observability-file-gcs` - Google Cloud Storage
- `@mastra/observability-clickhouse` - ClickHouse ingestion worker
