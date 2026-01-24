# @mastra/observability-clickhouse

ClickHouse storage and ingestion worker for MastraAdmin observability data.

## Installation

```bash
npm install @mastra/observability-clickhouse
```

## Prerequisites

- Node.js >= 22.13.0
- ClickHouse server
- A `FileStorageProvider` implementation (e.g., `@mastra/observability-file-local`)

## Usage

### Running the Ingestion Worker

The ingestion worker polls file storage for JSONL files and ingests them into ClickHouse.

#### Via CLI

```bash
# Run continuously
npx @mastra/observability-clickhouse ingest \
  --file-storage-type local \
  --file-storage-path /var/mastra/observability \
  --clickhouse-url http://localhost:8123 \
  --poll-interval 10000

# Run once (for cron)
npx @mastra/observability-clickhouse ingest \
  --file-storage-type local \
  --file-storage-path /var/mastra/observability \
  --clickhouse-url http://localhost:8123 \
  --once
```

#### Programmatically

```typescript
import { IngestionWorker } from '@mastra/observability-clickhouse';
import { LocalFileStorage } from '@mastra/observability-file-local';

const worker = new IngestionWorker({
  fileStorage: new LocalFileStorage({ baseDir: '/var/mastra/observability' }),
  clickhouse: {
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
  },
  pollIntervalMs: 10000,
  batchSize: 10,
});

await worker.init(); // Run migrations
await worker.start(); // Start polling

// Later...
await worker.stop();
```

### Querying Data

```typescript
import { ClickHouseQueryProvider } from '@mastra/observability-clickhouse';

const queryProvider = new ClickHouseQueryProvider({
  clickhouse: {
    url: 'http://localhost:8123',
    username: 'default',
    password: '',
  },
});

await queryProvider.init();

// List traces
const { traces, pagination } = await queryProvider.listTraces({
  projectId: 'proj_123',
  timeRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31'),
  },
  pagination: { page: 0, perPage: 50 },
});

// Get spans for a trace
const spans = await queryProvider.getSpansForTrace('trace_123');

// Get error rate over time
const errorRate = await queryProvider.getErrorRateTimeSeries({
  projectId: 'proj_123',
  intervalSeconds: 3600, // 1 hour buckets
  timeRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31'),
  },
});
```

### Running Migrations

```bash
# Run migrations
npx @mastra/observability-clickhouse migrate \
  --clickhouse-url http://localhost:8123

# Check migration status
npx @mastra/observability-clickhouse migrate \
  --clickhouse-url http://localhost:8123 \
  --check
```

## CLI Reference

### `ingest` Command

```
Options:
  --clickhouse-url <url>         ClickHouse server URL (required)
  --clickhouse-username <user>   ClickHouse username (default: "default")
  --clickhouse-password <pass>   ClickHouse password (default: "")
  --clickhouse-database <db>     ClickHouse database name
  --file-storage-type <type>     File storage type: local (required)
  --file-storage-path <path>     Base path for local file storage
  --base-path <path>             Base path for observability files (default: "observability")
  --poll-interval <ms>           Poll interval in milliseconds (default: 10000)
  --batch-size <count>           Files to process per batch (default: 10)
  --delete-after-process         Delete files instead of moving to processed/
  --project-id <id>              Only process files for specific project
  --once                         Process files once and exit
  --debug                        Enable debug logging
```

### `migrate` Command

```
Options:
  --clickhouse-url <url>         ClickHouse server URL (required)
  --clickhouse-username <user>   ClickHouse username (default: "default")
  --clickhouse-password <pass>   ClickHouse password (default: "")
  --clickhouse-database <db>     ClickHouse database name
  --check                        Only check status, don't run migrations
```

## ClickHouse Schema

### Tables

- `mastra_admin_traces` - Trace records
- `mastra_admin_spans` - Span records
- `mastra_admin_logs` - Log records
- `mastra_admin_metrics` - Metric records
- `mastra_admin_scores` - Score records

### Materialized Views

For efficient aggregation queries:

- `mastra_admin_traces_hourly_stats`
- `mastra_admin_spans_hourly_stats`
- `mastra_admin_logs_hourly_stats`
- `mastra_admin_metrics_hourly_stats`
- `mastra_admin_scores_hourly_stats`

## Related Packages

- `@mastra/admin` - Core types and interfaces
- `@mastra/observability-writer` - Writes observability events to file storage
- `@mastra/observability-file-local` - Local filesystem storage adapter
