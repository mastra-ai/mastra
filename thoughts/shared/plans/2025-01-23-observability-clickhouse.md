# LANE 3c: @mastra/observability-clickhouse Implementation Plan

## Overview

This plan details the implementation of `@mastra/observability-clickhouse`, a package that provides ClickHouse schema management, query capabilities, and an ingestion worker for processing JSONL observability files into ClickHouse.

**Package Location**: `observability/clickhouse/`
**Package Name**: `@mastra/observability-clickhouse`
**Priority**: P1
**Dependencies**:

- LANE 3a (@mastra/observability-writer) - for file naming conventions and event types
- LANE 3b (@mastra/observability-file-local) - for FileStorageProvider interface

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    @mastra/observability-clickhouse                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   File Storage              Ingestion Worker            ClickHouse           │
│   (LANE 3b)                 (this package)              (database)           │
│   ┌──────────────┐         ┌──────────────────┐        ┌─────────────────┐  │
│   │ LocalFS / S3 │         │                  │        │                 │  │
│   │ / GCS        │ ──────► │  IngestionWorker │ ─────► │  traces table   │  │
│   │              │  poll   │  ┌────────────┐  │ insert │  spans table    │  │
│   │ pending/     │  files  │  │ File       │  │        │  logs table     │  │
│   │ ├─ traces/   │         │  │ Processor  │  │        │  metrics table  │  │
│   │ ├─ spans/    │         │  └────────────┘  │        │  scores table   │  │
│   │ ├─ logs/     │         │        │         │        │                 │  │
│   │ └─ ...       │         │        ▼         │        │  Materialized   │  │
│   │              │         │  ┌────────────┐  │        │  Views          │  │
│   │ processed/   │ ◄────── │  │ Bulk       │  │        │                 │  │
│   │ └─ ...       │  move   │  │ Inserter   │  │        └─────────────────┘  │
│   └──────────────┘         │  └────────────┘  │                              │
│                            └──────────────────┘                              │
│                                                                              │
│                       ┌──────────────────────────────┐                       │
│                       │   ClickHouseQueryProvider    │                       │
│                       │   - Query traces/spans/logs  │                       │
│                       │   - Time-range filtering     │                       │
│                       │   - Aggregation queries      │                       │
│                       │   - By project/deployment    │                       │
│                       └──────────────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
observability/clickhouse/
├── src/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # Package-specific types
│   │
│   ├── schema/
│   │   ├── index.ts                # Schema exports
│   │   ├── tables.ts               # Table definitions (traces, spans, logs, metrics, scores)
│   │   ├── migrations.ts           # Schema migrations
│   │   └── materialized-views.ts   # Materialized views for aggregations
│   │
│   ├── query-provider/
│   │   ├── index.ts                # ClickHouseQueryProvider class
│   │   ├── traces.ts               # Trace queries
│   │   ├── spans.ts                # Span queries
│   │   ├── logs.ts                 # Log queries
│   │   ├── metrics.ts              # Metric queries
│   │   ├── scores.ts               # Score queries
│   │   └── analytics.ts            # Aggregation/analytics queries
│   │
│   ├── ingestion/
│   │   ├── index.ts                # Ingestion exports
│   │   ├── worker.ts               # IngestionWorker class
│   │   ├── file-processor.ts       # JSONL file parsing
│   │   ├── bulk-inserter.ts        # ClickHouse bulk insert
│   │   └── state.ts                # Processing state management
│   │
│   ├── cli/
│   │   ├── index.ts                # CLI entry point
│   │   └── commands/
│   │       ├── ingest.ts           # `ingest` command
│   │       └── migrate.ts          # `migrate` command
│   │
│   └── utils/
│       ├── client.ts               # ClickHouse client utilities
│       └── transforms.ts           # Data transformation helpers
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── CHANGELOG.md
└── README.md
```

---

## Implementation Phases

### Phase 1: Package Setup

#### 1.1 Create package.json

**File**: `observability/clickhouse/package.json`

```json
{
  "name": "@mastra/observability-clickhouse",
  "version": "0.0.1",
  "description": "ClickHouse storage and ingestion worker for MastraAdmin observability data",
  "type": "module",
  "license": "Apache-2.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "mastra-observability-clickhouse": "./dist/cli/index.js"
  },
  "files": ["dist", "CHANGELOG.md"],
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./cli": {
      "import": {
        "types": "./dist/cli/index.d.ts",
        "default": "./dist/cli/index.js"
      }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:watch": "pnpm build:lib --watch",
    "check": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "lint": "eslint ."
  },
  "dependencies": {
    "@clickhouse/client": "^1.12.1",
    "commander": "^14.0.0"
  },
  "peerDependencies": {
    "@mastra/admin": "workspace:*"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/admin": "workspace:*",
    "@mastra/observability-writer": "workspace:*",
    "@mastra/observability-file-local": "workspace:*",
    "@types/node": "22.13.17",
    "@vitest/coverage-v8": "catalog:",
    "tsup": "^8.3.5",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "engines": {
    "node": ">=22.13.0"
  }
}
```

#### 1.2 Create tsconfig.json

**File**: `observability/clickhouse/tsconfig.json`

```json
{
  "extends": "../../tsconfig.node.json",
  "include": ["src/**/*", "tsup.config.ts"],
  "exclude": ["node_modules", "**/*.test.ts"],
  "compilerOptions": {
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

#### 1.3 Create tsup.config.ts

**File**: `observability/clickhouse/tsup.config.ts`

```typescript
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: { preset: 'smallest' },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
```

#### 1.4 Create vitest.config.ts

**File**: `observability/clickhouse/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 30000, // ClickHouse operations may take longer
  },
});
```

---

### Phase 2: Core Types

#### 2.1 Create types.ts

**File**: `observability/clickhouse/src/types.ts`

```typescript
/**
 * Types for @mastra/observability-clickhouse
 */

import type { ClickHouseClient, ClickHouseClientConfigOptions } from '@clickhouse/client';

// Re-export types from @mastra/admin
export type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityEventType,
  FileStorageProvider,
  FileInfo,
  ObservabilityQueryProvider,
} from '@mastra/admin';

/**
 * ClickHouse connection configuration.
 * Accepts either a pre-configured client or connection credentials.
 */
export type ClickHouseConfig =
  | {
      /** Pre-configured ClickHouse client */
      client: ClickHouseClient;
    }
  | {
      /** ClickHouse server URL */
      url: string;
      /** ClickHouse username */
      username: string;
      /** ClickHouse password */
      password: string;
      /** Database name */
      database?: string;
      /** Additional client options */
      options?: Omit<ClickHouseClientConfigOptions, 'url' | 'username' | 'password' | 'database'>;
    };

/**
 * Configuration for the IngestionWorker
 */
export interface IngestionWorkerConfig {
  /**
   * File storage provider to read JSONL files from.
   */
  fileStorage: import('@mastra/admin').FileStorageProvider;

  /**
   * ClickHouse connection configuration.
   */
  clickhouse: ClickHouseConfig;

  /**
   * Interval in milliseconds between polling for new files.
   * @default 10000 (10 seconds)
   */
  pollIntervalMs?: number;

  /**
   * Maximum number of files to process in a single batch.
   * @default 10
   */
  batchSize?: number;

  /**
   * Maximum number of events to insert in a single ClickHouse batch.
   * @default 10000
   */
  insertBatchSize?: number;

  /**
   * Base path in file storage where observability files are stored.
   * @default 'observability'
   */
  basePath?: string;

  /**
   * Whether to delete files after processing instead of moving to processed/.
   * @default false
   */
  deleteAfterProcess?: boolean;

  /**
   * Number of retry attempts for failed operations.
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay in milliseconds between retry attempts.
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Project ID to filter files by (optional).
   * If not specified, processes files for all projects.
   */
  projectId?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Result of a single processing cycle
 */
export interface ProcessingResult {
  /** Number of files processed */
  filesProcessed: number;
  /** Number of events ingested into ClickHouse */
  eventsIngested: number;
  /** Breakdown by event type */
  eventsByType: Record<string, number>;
  /** Errors encountered during processing */
  errors: ProcessingError[];
  /** Duration of processing in milliseconds */
  durationMs: number;
}

/**
 * Error encountered during file processing
 */
export interface ProcessingError {
  /** File path that failed */
  filePath: string;
  /** Error message */
  message: string;
  /** Error details */
  error: Error;
  /** Retry count at time of failure */
  retryCount: number;
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  /** Whether the worker is currently running */
  isRunning: boolean;
  /** Whether the worker is currently processing files */
  isProcessing: boolean;
  /** Timestamp of last successful processing */
  lastProcessedAt: Date | null;
  /** Total files processed since worker started */
  totalFilesProcessed: number;
  /** Total events ingested since worker started */
  totalEventsIngested: number;
  /** Breakdown of total events by type */
  totalEventsByType: Record<string, number>;
  /** Current error count (resets on successful processing) */
  currentErrors: ProcessingError[];
  /** Worker start time */
  startedAt: Date | null;
}

/**
 * Configuration for ClickHouseQueryProvider
 */
export interface QueryProviderConfig {
  /**
   * ClickHouse connection configuration.
   */
  clickhouse: ClickHouseConfig;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Time range filter for queries
 */
export interface TimeRangeFilter {
  /** Start of time range (inclusive) */
  start?: Date;
  /** End of time range (inclusive) */
  end?: Date;
}

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  /** Page number (0-indexed) */
  page?: number;
  /** Number of items per page */
  perPage?: number;
}

/**
 * Pagination info returned with list queries
 */
export interface PaginationInfo {
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/**
 * Common filter options for observability queries
 */
export interface ObservabilityFilters {
  /** Filter by project ID */
  projectId?: string;
  /** Filter by deployment ID */
  deploymentId?: string;
  /** Filter by time range */
  timeRange?: TimeRangeFilter;
}

/**
 * Query options for traces
 */
export interface TraceQueryOptions extends ObservabilityFilters {
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by trace status */
  status?: 'ok' | 'error' | 'unset';
  /** Filter by trace name (partial match) */
  name?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for spans
 */
export interface SpanQueryOptions extends ObservabilityFilters {
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by span ID */
  spanId?: string;
  /** Filter by parent span ID */
  parentSpanId?: string;
  /** Filter by span kind */
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  /** Filter by span name (partial match) */
  name?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for logs
 */
export interface LogQueryOptions extends ObservabilityFilters {
  /** Filter by log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Filter by trace ID */
  traceId?: string;
  /** Filter by span ID */
  spanId?: string;
  /** Filter by message content (partial match) */
  message?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for metrics
 */
export interface MetricQueryOptions extends ObservabilityFilters {
  /** Filter by metric name */
  name?: string;
  /** Filter by metric type */
  type?: 'counter' | 'gauge' | 'histogram';
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Query options for scores
 */
export interface ScoreQueryOptions extends ObservabilityFilters {
  /** Filter by score name */
  name?: string;
  /** Filter by trace ID */
  traceId?: string;
  /** Minimum score value */
  minValue?: number;
  /** Maximum score value */
  maxValue?: number;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Aggregation bucket for time-series data
 */
export interface TimeBucket {
  /** Bucket start time */
  timestamp: Date;
  /** Count of items in bucket */
  count: number;
  /** Additional aggregated values */
  values?: Record<string, number>;
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Bucket interval in seconds */
  intervalSeconds: number;
  /** Time range for aggregation */
  timeRange: TimeRangeFilter;
  /** Group by fields */
  groupBy?: string[];
}
```

---

### Phase 3: ClickHouse Schema

#### 3.1 Create schema/tables.ts

**File**: `observability/clickhouse/src/schema/tables.ts`

```typescript
/**
 * ClickHouse table definitions for observability data.
 *
 * Uses MergeTree engine family for efficient time-series storage.
 * Tables are partitioned by month for efficient data management.
 */

/**
 * SQL for creating the traces table.
 * Traces represent complete request/operation lifecycles.
 */
export const TRACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_traces (
  -- Identity
  trace_id String,
  project_id String,
  deployment_id String,

  -- Trace info
  name String,
  status Enum8('ok' = 1, 'error' = 2, 'unset' = 0),

  -- Timing
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration_ms Nullable(Int64),

  -- Data
  input String DEFAULT '',
  output String DEFAULT '',
  metadata String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, deployment_id, start_time, trace_id)
TTL start_time + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the spans table.
 * Spans represent individual operations within a trace.
 */
export const SPANS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_spans (
  -- Identity
  span_id String,
  trace_id String,
  parent_span_id Nullable(String),
  project_id String,
  deployment_id String,

  -- Span info
  name String,
  kind Enum8('internal' = 0, 'server' = 1, 'client' = 2, 'producer' = 3, 'consumer' = 4),
  status Enum8('ok' = 1, 'error' = 2, 'unset' = 0),

  -- Timing
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration_ms Nullable(Int64),

  -- Data
  attributes String DEFAULT '{}',
  events String DEFAULT '[]',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, deployment_id, trace_id, span_id)
TTL start_time + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the logs table.
 * Logs capture textual information with severity levels.
 */
export const LOGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_logs (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Correlation
  trace_id Nullable(String),
  span_id Nullable(String),

  -- Log info
  level Enum8('debug' = 0, 'info' = 1, 'warn' = 2, 'error' = 3),
  message String,
  timestamp DateTime64(3),

  -- Data
  attributes String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, timestamp, id)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the metrics table.
 * Metrics capture numeric measurements.
 */
export const METRICS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_metrics (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Metric info
  name String,
  type Enum8('counter' = 0, 'gauge' = 1, 'histogram' = 2),
  value Float64,
  unit Nullable(String),
  timestamp DateTime64(3),

  -- Labels (for grouping/filtering)
  labels String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, name, timestamp, id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * SQL for creating the scores table.
 * Scores capture evaluation results.
 */
export const SCORES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS mastra_admin_scores (
  -- Identity
  id String,
  project_id String,
  deployment_id String,

  -- Correlation
  trace_id Nullable(String),

  -- Score info
  name String,
  value Float64,
  normalized_value Nullable(Float64),
  comment Nullable(String),
  timestamp DateTime64(3),

  -- Data
  metadata String DEFAULT '{}',

  -- Ingestion metadata
  recorded_at DateTime64(3),
  ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, deployment_id, name, timestamp, id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
`;

/**
 * All table creation SQL statements
 */
export const ALL_TABLES_SQL = [TRACES_TABLE_SQL, SPANS_TABLE_SQL, LOGS_TABLE_SQL, METRICS_TABLE_SQL, SCORES_TABLE_SQL];

/**
 * Table names
 */
export const TABLE_NAMES = {
  TRACES: 'mastra_admin_traces',
  SPANS: 'mastra_admin_spans',
  LOGS: 'mastra_admin_logs',
  METRICS: 'mastra_admin_metrics',
  SCORES: 'mastra_admin_scores',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
```

#### 3.2 Create schema/materialized-views.ts

**File**: `observability/clickhouse/src/schema/materialized-views.ts`

```typescript
/**
 * Materialized views for efficient aggregation queries.
 */

import { TABLE_NAMES } from './tables.js';

/**
 * Hourly trace statistics per project/deployment
 */
export const TRACES_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_traces_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, status)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(start_time) AS hour,
  status,
  count() AS count,
  sum(duration_ms) AS total_duration_ms,
  avg(duration_ms) AS avg_duration_ms
FROM ${TABLE_NAMES.TRACES}
GROUP BY project_id, deployment_id, hour, status
`;

/**
 * Hourly span statistics per project/deployment
 */
export const SPANS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_spans_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, kind, status)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(start_time) AS hour,
  kind,
  status,
  count() AS count,
  sum(duration_ms) AS total_duration_ms,
  avg(duration_ms) AS avg_duration_ms
FROM ${TABLE_NAMES.SPANS}
GROUP BY project_id, deployment_id, hour, kind, status
`;

/**
 * Hourly log level counts per project/deployment
 */
export const LOGS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_logs_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, hour, level)
AS SELECT
  project_id,
  deployment_id,
  toStartOfHour(timestamp) AS hour,
  level,
  count() AS count
FROM ${TABLE_NAMES.LOGS}
GROUP BY project_id, deployment_id, hour, level
`;

/**
 * Hourly metric aggregations per project/deployment/metric name
 */
export const METRICS_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_metrics_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, name, hour)
AS SELECT
  project_id,
  deployment_id,
  name,
  toStartOfHour(timestamp) AS hour,
  count() AS count,
  sum(value) AS sum_value,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value
FROM ${TABLE_NAMES.METRICS}
GROUP BY project_id, deployment_id, name, hour
`;

/**
 * Hourly score aggregations per project/deployment/score name
 */
export const SCORES_HOURLY_STATS_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mastra_admin_scores_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (project_id, deployment_id, name, hour)
AS SELECT
  project_id,
  deployment_id,
  name,
  toStartOfHour(timestamp) AS hour,
  count() AS count,
  sum(value) AS sum_value,
  avg(value) AS avg_value,
  min(value) AS min_value,
  max(value) AS max_value
FROM ${TABLE_NAMES.SCORES}
GROUP BY project_id, deployment_id, name, hour
`;

/**
 * All materialized view creation SQL statements
 */
export const ALL_MATERIALIZED_VIEWS_SQL = [
  TRACES_HOURLY_STATS_VIEW_SQL,
  SPANS_HOURLY_STATS_VIEW_SQL,
  LOGS_HOURLY_STATS_VIEW_SQL,
  METRICS_HOURLY_STATS_VIEW_SQL,
  SCORES_HOURLY_STATS_VIEW_SQL,
];

/**
 * Materialized view names
 */
export const VIEW_NAMES = {
  TRACES_HOURLY: 'mastra_admin_traces_hourly_stats',
  SPANS_HOURLY: 'mastra_admin_spans_hourly_stats',
  LOGS_HOURLY: 'mastra_admin_logs_hourly_stats',
  METRICS_HOURLY: 'mastra_admin_metrics_hourly_stats',
  SCORES_HOURLY: 'mastra_admin_scores_hourly_stats',
} as const;
```

#### 3.3 Create schema/migrations.ts

**File**: `observability/clickhouse/src/schema/migrations.ts`

```typescript
/**
 * Schema migration utilities for ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { ALL_TABLES_SQL } from './tables.js';
import { ALL_MATERIALIZED_VIEWS_SQL } from './materialized-views.js';

/**
 * Run all migrations to set up the schema.
 * Safe to call multiple times - uses CREATE IF NOT EXISTS.
 */
export async function runMigrations(client: ClickHouseClient): Promise<void> {
  // Create tables
  for (const sql of ALL_TABLES_SQL) {
    await client.command({ query: sql });
  }

  // Create materialized views
  for (const sql of ALL_MATERIALIZED_VIEWS_SQL) {
    await client.command({ query: sql });
  }
}

/**
 * Check if the schema is up to date.
 * Returns true if all tables and views exist.
 */
export async function checkSchemaStatus(client: ClickHouseClient): Promise<{
  isInitialized: boolean;
  missingTables: string[];
  missingViews: string[];
}> {
  const expectedTables = [
    'mastra_admin_traces',
    'mastra_admin_spans',
    'mastra_admin_logs',
    'mastra_admin_metrics',
    'mastra_admin_scores',
  ];

  const expectedViews = [
    'mastra_admin_traces_hourly_stats',
    'mastra_admin_spans_hourly_stats',
    'mastra_admin_logs_hourly_stats',
    'mastra_admin_metrics_hourly_stats',
    'mastra_admin_scores_hourly_stats',
  ];

  // Query existing tables
  const tablesResult = await client.query({
    query: `SELECT name FROM system.tables WHERE database = currentDatabase() AND name LIKE 'mastra_admin_%'`,
    format: 'JSONEachRow',
  });
  const existingTables = new Set((await tablesResult.json<{ name: string }>()).map(r => r.name));

  const missingTables = expectedTables.filter(t => !existingTables.has(t));
  const missingViews = expectedViews.filter(v => !existingTables.has(v));

  return {
    isInitialized: missingTables.length === 0 && missingViews.length === 0,
    missingTables,
    missingViews,
  };
}

/**
 * Drop all tables and views (for testing/reset).
 * WARNING: This deletes all data!
 */
export async function dropAllTables(client: ClickHouseClient): Promise<void> {
  const tables = [
    'mastra_admin_traces_hourly_stats',
    'mastra_admin_spans_hourly_stats',
    'mastra_admin_logs_hourly_stats',
    'mastra_admin_metrics_hourly_stats',
    'mastra_admin_scores_hourly_stats',
    'mastra_admin_traces',
    'mastra_admin_spans',
    'mastra_admin_logs',
    'mastra_admin_metrics',
    'mastra_admin_scores',
  ];

  for (const table of tables) {
    await client.command({ query: `DROP TABLE IF EXISTS ${table}` });
  }
}
```

#### 3.4 Create schema/index.ts

**File**: `observability/clickhouse/src/schema/index.ts`

```typescript
export * from './tables.js';
export * from './materialized-views.js';
export * from './migrations.js';
```

---

### Phase 4: Ingestion Worker

#### 4.1 Create ingestion/file-processor.ts

**File**: `observability/clickhouse/src/ingestion/file-processor.ts`

```typescript
/**
 * JSONL file processor for observability data.
 */

import type { FileStorageProvider, ObservabilityEvent, ObservabilityEventType } from '../types.js';
import { parseFilePath, isPendingFile } from '@mastra/observability-writer';

/**
 * Parsed event from a JSONL file
 */
export interface ParsedEvent {
  type: ObservabilityEventType;
  data: ObservabilityEvent;
  line: number;
}

/**
 * Result of processing a single file
 */
export interface FileProcessingResult {
  filePath: string;
  events: ParsedEvent[];
  errors: Array<{ line: number; error: string }>;
  metadata: {
    type: string;
    projectId: string;
    timestamp: string;
  } | null;
}

/**
 * Process a JSONL file and extract events.
 */
export async function processFile(fileStorage: FileStorageProvider, filePath: string): Promise<FileProcessingResult> {
  const result: FileProcessingResult = {
    filePath,
    events: [],
    errors: [],
    metadata: null,
  };

  // Parse file path to extract metadata
  const pathInfo = parseFilePath(filePath);
  if (pathInfo) {
    result.metadata = {
      type: pathInfo.type,
      projectId: pathInfo.projectId,
      timestamp: pathInfo.timestamp,
    };
  }

  // Read file content
  const content = await fileStorage.read(filePath);
  const lines = content.toString('utf-8').split('\n');

  // Parse each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    try {
      const event = JSON.parse(line) as ObservabilityEvent;

      // Validate event has required type field
      if (!event.type || !['trace', 'span', 'log', 'metric', 'score'].includes(event.type)) {
        result.errors.push({
          line: i + 1,
          error: `Invalid or missing event type: ${event.type}`,
        });
        continue;
      }

      result.events.push({
        type: event.type,
        data: event,
        line: i + 1,
      });
    } catch (error) {
      result.errors.push({
        line: i + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

/**
 * List pending JSONL files from file storage.
 * Returns files sorted by lastModified (oldest first) for FIFO processing.
 */
export async function listPendingFiles(
  fileStorage: FileStorageProvider,
  basePath: string,
  options?: {
    projectId?: string;
    eventType?: ObservabilityEventType;
    limit?: number;
  },
): Promise<string[]> {
  // Build the prefix for listing
  let prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

  if (options?.eventType) {
    prefix = `${prefix}${options.eventType}/`;
    if (options?.projectId) {
      prefix = `${prefix}${options.projectId}/`;
    }
  } else if (options?.projectId) {
    // If only projectId is specified, we need to list all event type directories
    const eventTypes: ObservabilityEventType[] = ['trace', 'span', 'log', 'metric', 'score'];
    const allFiles: string[] = [];

    for (const type of eventTypes) {
      const typePrefix = `${prefix}${type}/${options.projectId}/`;
      const files = await fileStorage.list(typePrefix);
      const pendingFiles = files.filter(f => isPendingFile(f.path)).map(f => f.path);
      allFiles.push(...pendingFiles);
    }

    // Sort by lastModified would require re-fetching file info
    // For simplicity, rely on the individual list calls being sorted
    return options?.limit ? allFiles.slice(0, options.limit) : allFiles;
  }

  const files = await fileStorage.list(prefix);
  const pendingFiles = files.filter(f => isPendingFile(f.path)).map(f => f.path);

  return options?.limit ? pendingFiles.slice(0, options.limit) : pendingFiles;
}
```

#### 4.2 Create ingestion/bulk-inserter.ts

**File**: `observability/clickhouse/src/ingestion/bulk-inserter.ts`

```typescript
/**
 * Bulk inserter for ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import type { ObservabilityEvent, ObservabilityEventType } from '../types.js';
import { TABLE_NAMES } from '../schema/tables.js';

/**
 * Transform an event to ClickHouse row format.
 */
function transformEvent(event: ObservabilityEvent): Record<string, unknown> {
  const now = Date.now();

  switch (event.type) {
    case 'trace':
      return {
        trace_id: event.id,
        project_id: event.projectId,
        deployment_id: event.deploymentId || '',
        name: event.name,
        status: event.status || 'unset',
        start_time: event.startTime,
        end_time: event.endTime || null,
        duration_ms: event.durationMs || null,
        input: event.input ? JSON.stringify(event.input) : '',
        output: event.output ? JSON.stringify(event.output) : '',
        metadata: event.metadata ? JSON.stringify(event.metadata) : '{}',
        recorded_at: event.recordedAt || new Date().toISOString(),
        ingested_at: now,
      };

    case 'span':
      return {
        span_id: event.id,
        trace_id: event.traceId,
        parent_span_id: event.parentSpanId || null,
        project_id: event.projectId,
        deployment_id: event.deploymentId || '',
        name: event.name,
        kind: event.kind || 'internal',
        status: event.status || 'unset',
        start_time: event.startTime,
        end_time: event.endTime || null,
        duration_ms: event.durationMs || null,
        attributes: event.attributes ? JSON.stringify(event.attributes) : '{}',
        events: event.events ? JSON.stringify(event.events) : '[]',
        recorded_at: event.recordedAt || new Date().toISOString(),
        ingested_at: now,
      };

    case 'log':
      return {
        id: event.id,
        project_id: event.projectId,
        deployment_id: event.deploymentId || '',
        trace_id: event.traceId || null,
        span_id: event.spanId || null,
        level: event.level,
        message: event.message,
        timestamp: event.timestamp,
        attributes: event.attributes ? JSON.stringify(event.attributes) : '{}',
        recorded_at: event.recordedAt || new Date().toISOString(),
        ingested_at: now,
      };

    case 'metric':
      return {
        id: event.id,
        project_id: event.projectId,
        deployment_id: event.deploymentId || '',
        name: event.name,
        type: event.metricType || 'gauge',
        value: event.value,
        unit: event.unit || null,
        timestamp: event.timestamp,
        labels: event.labels ? JSON.stringify(event.labels) : '{}',
        recorded_at: event.recordedAt || new Date().toISOString(),
        ingested_at: now,
      };

    case 'score':
      return {
        id: event.id,
        project_id: event.projectId,
        deployment_id: event.deploymentId || '',
        trace_id: event.traceId || null,
        name: event.name,
        value: event.value,
        normalized_value: event.normalizedValue || null,
        comment: event.comment || null,
        timestamp: event.timestamp,
        metadata: event.metadata ? JSON.stringify(event.metadata) : '{}',
        recorded_at: event.recordedAt || new Date().toISOString(),
        ingested_at: now,
      };

    default:
      throw new Error(`Unknown event type: ${(event as any).type}`);
  }
}

/**
 * Get the table name for an event type.
 */
function getTableForType(type: ObservabilityEventType): string {
  switch (type) {
    case 'trace':
      return TABLE_NAMES.TRACES;
    case 'span':
      return TABLE_NAMES.SPANS;
    case 'log':
      return TABLE_NAMES.LOGS;
    case 'metric':
      return TABLE_NAMES.METRICS;
    case 'score':
      return TABLE_NAMES.SCORES;
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Bulk insert events into ClickHouse.
 * Groups events by type and inserts into appropriate tables.
 */
export async function bulkInsert(
  client: ClickHouseClient,
  events: Array<{ type: ObservabilityEventType; data: ObservabilityEvent }>,
): Promise<{ insertedByType: Record<string, number> }> {
  // Group events by type
  const eventsByType = new Map<ObservabilityEventType, ObservabilityEvent[]>();

  for (const event of events) {
    const existing = eventsByType.get(event.type) || [];
    existing.push(event.data);
    eventsByType.set(event.type, existing);
  }

  const insertedByType: Record<string, number> = {};

  // Insert each type into its table
  for (const [type, typeEvents] of eventsByType) {
    const tableName = getTableForType(type);
    const rows = typeEvents.map(transformEvent);

    await client.insert({
      table: tableName,
      values: rows,
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        use_client_time_zone: 1,
      },
    });

    insertedByType[type] = typeEvents.length;
  }

  return { insertedByType };
}
```

#### 4.3 Create ingestion/worker.ts

**File**: `observability/clickhouse/src/ingestion/worker.ts`

```typescript
/**
 * Ingestion worker for processing JSONL files into ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type {
  IngestionWorkerConfig,
  ProcessingResult,
  ProcessingError,
  WorkerStatus,
  FileStorageProvider,
} from '../types.js';
import { processFile, listPendingFiles } from './file-processor.js';
import { bulkInsert } from './bulk-inserter.js';
import { runMigrations } from '../schema/migrations.js';
import { getProcessedFilePath } from '@mastra/observability-writer';

/**
 * Default configuration values
 */
const DEFAULT_POLL_INTERVAL_MS = 10000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_INSERT_BATCH_SIZE = 10000;
const DEFAULT_BASE_PATH = 'observability';
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * IngestionWorker continuously polls file storage for new JSONL files
 * and ingests them into ClickHouse.
 */
export class IngestionWorker {
  private readonly fileStorage: FileStorageProvider;
  private readonly client: ClickHouseClient;
  private readonly config: Required<
    Omit<IngestionWorkerConfig, 'fileStorage' | 'clickhouse' | 'projectId'> & {
      projectId: string | undefined;
    }
  >;

  private isRunning = false;
  private isProcessing = false;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  // Statistics
  private startedAt: Date | null = null;
  private lastProcessedAt: Date | null = null;
  private totalFilesProcessed = 0;
  private totalEventsIngested = 0;
  private totalEventsByType: Record<string, number> = {};
  private currentErrors: ProcessingError[] = [];

  constructor(config: IngestionWorkerConfig) {
    this.fileStorage = config.fileStorage;

    // Create or use provided ClickHouse client
    if ('client' in config.clickhouse) {
      this.client = config.clickhouse.client;
    } else {
      this.client = createClient({
        url: config.clickhouse.url,
        username: config.clickhouse.username,
        password: config.clickhouse.password,
        database: config.clickhouse.database,
        ...config.clickhouse.options,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });
    }

    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      insertBatchSize: config.insertBatchSize ?? DEFAULT_INSERT_BATCH_SIZE,
      basePath: config.basePath ?? DEFAULT_BASE_PATH,
      deleteAfterProcess: config.deleteAfterProcess ?? false,
      retryAttempts: config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
      retryDelayMs: config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      projectId: config.projectId,
      debug: config.debug ?? false,
    };
  }

  /**
   * Initialize the worker (run migrations).
   */
  async init(): Promise<void> {
    await runMigrations(this.client);
  }

  /**
   * Start the worker. It will continuously poll for files.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startedAt = new Date();
    this.currentErrors = [];

    if (this.config.debug) {
      console.log('[IngestionWorker] Starting...');
    }

    // Start the poll loop
    this.schedulePoll();
  }

  /**
   * Stop the worker gracefully.
   * Waits for any in-progress processing to complete.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.config.debug) {
      console.log('[IngestionWorker] Stopping...');
    }

    this.isRunning = false;

    // Clear any pending poll
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    // Wait for in-progress processing
    if (this.isProcessing && !this.shutdownPromise) {
      this.shutdownPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isProcessing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    if (this.shutdownPromise) {
      await this.shutdownPromise;
    }

    if (this.config.debug) {
      console.log('[IngestionWorker] Stopped');
    }
  }

  /**
   * Process files once (for manual/cron-based execution).
   */
  async processOnce(): Promise<ProcessingResult> {
    return this.runProcessingCycle();
  }

  /**
   * Get current worker status.
   */
  getStatus(): WorkerStatus {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      lastProcessedAt: this.lastProcessedAt,
      totalFilesProcessed: this.totalFilesProcessed,
      totalEventsIngested: this.totalEventsIngested,
      totalEventsByType: { ...this.totalEventsByType },
      currentErrors: [...this.currentErrors],
      startedAt: this.startedAt,
    };
  }

  /**
   * Schedule the next poll.
   */
  private schedulePoll(): void {
    if (!this.isRunning) {
      return;
    }

    this.pollTimeout = setTimeout(async () => {
      try {
        await this.runProcessingCycle();
      } catch (error) {
        if (this.config.debug) {
          console.error('[IngestionWorker] Processing cycle error:', error);
        }
      }
      this.schedulePoll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Run a single processing cycle.
   */
  private async runProcessingCycle(): Promise<ProcessingResult> {
    if (this.isProcessing) {
      return {
        filesProcessed: 0,
        eventsIngested: 0,
        eventsByType: {},
        errors: [],
        durationMs: 0,
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    const result: ProcessingResult = {
      filesProcessed: 0,
      eventsIngested: 0,
      eventsByType: {},
      errors: [],
      durationMs: 0,
    };

    try {
      // List pending files
      const files = await listPendingFiles(this.fileStorage, this.config.basePath, {
        projectId: this.config.projectId,
        limit: this.config.batchSize,
      });

      if (files.length === 0) {
        if (this.config.debug) {
          console.log('[IngestionWorker] No pending files');
        }
        return result;
      }

      if (this.config.debug) {
        console.log(`[IngestionWorker] Found ${files.length} pending files`);
      }

      // Process each file
      for (const filePath of files) {
        await this.processFileWithRetry(filePath, result);
      }

      // Update statistics
      this.totalFilesProcessed += result.filesProcessed;
      this.totalEventsIngested += result.eventsIngested;
      for (const [type, count] of Object.entries(result.eventsByType)) {
        this.totalEventsByType[type] = (this.totalEventsByType[type] || 0) + count;
      }
      this.lastProcessedAt = new Date();

      // Clear errors on successful processing
      if (result.errors.length === 0) {
        this.currentErrors = [];
      } else {
        this.currentErrors = result.errors;
      }
    } finally {
      this.isProcessing = false;
      result.durationMs = Date.now() - startTime;
    }

    if (this.config.debug) {
      console.log(
        `[IngestionWorker] Processed ${result.filesProcessed} files, ` +
          `${result.eventsIngested} events in ${result.durationMs}ms`,
      );
    }

    return result;
  }

  /**
   * Process a single file with retry logic.
   */
  private async processFileWithRetry(filePath: string, result: ProcessingResult): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        // Process the file
        const fileResult = await processFile(this.fileStorage, filePath);

        if (fileResult.errors.length > 0 && this.config.debug) {
          console.warn(`[IngestionWorker] ${fileResult.errors.length} parse errors in ${filePath}`);
        }

        if (fileResult.events.length > 0) {
          // Insert events into ClickHouse
          const { insertedByType } = await bulkInsert(
            this.client,
            fileResult.events.map(e => ({ type: e.type, data: e.data })),
          );

          result.eventsIngested += fileResult.events.length;
          for (const [type, count] of Object.entries(insertedByType)) {
            result.eventsByType[type] = (result.eventsByType[type] || 0) + count;
          }
        }

        // Move or delete the file
        if (this.config.deleteAfterProcess) {
          await this.fileStorage.delete(filePath);
        } else {
          const processedPath = getProcessedFilePath(filePath);
          await this.fileStorage.move(filePath, processedPath);
        }

        result.filesProcessed += 1;
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retryAttempts - 1) {
          if (this.config.debug) {
            console.warn(`[IngestionWorker] Retry ${attempt + 1}/${this.config.retryAttempts} for ${filePath}`);
          }
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    // All retries failed
    result.errors.push({
      filePath,
      message: lastError?.message || 'Unknown error',
      error: lastError || new Error('Unknown error'),
      retryCount: this.config.retryAttempts,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 4.4 Create ingestion/index.ts

**File**: `observability/clickhouse/src/ingestion/index.ts`

```typescript
export { IngestionWorker } from './worker.js';
export { processFile, listPendingFiles } from './file-processor.js';
export type { FileProcessingResult, ParsedEvent } from './file-processor.js';
export { bulkInsert } from './bulk-inserter.js';
```

---

### Phase 5: Query Provider

#### 5.1 Create query-provider/index.ts

**File**: `observability/clickhouse/src/query-provider/index.ts`

```typescript
/**
 * ClickHouse query provider for observability data.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';
import type {
  QueryProviderConfig,
  TraceQueryOptions,
  SpanQueryOptions,
  LogQueryOptions,
  MetricQueryOptions,
  ScoreQueryOptions,
  PaginationInfo,
  TimeBucket,
  AggregationOptions,
  Trace,
  Span,
  Log,
  Metric,
  Score,
} from '../types.js';
import { TABLE_NAMES, VIEW_NAMES } from '../schema/index.js';
import { runMigrations, checkSchemaStatus } from '../schema/migrations.js';

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 0;
const DEFAULT_PER_PAGE = 50;

/**
 * ClickHouseQueryProvider provides read access to observability data.
 * Implements the ObservabilityQueryProvider interface from @mastra/admin.
 */
export class ClickHouseQueryProvider {
  private readonly client: ClickHouseClient;
  private readonly debug: boolean;

  constructor(config: QueryProviderConfig) {
    // Create or use provided ClickHouse client
    if ('client' in config.clickhouse) {
      this.client = config.clickhouse.client;
    } else {
      this.client = createClient({
        url: config.clickhouse.url,
        username: config.clickhouse.username,
        password: config.clickhouse.password,
        database: config.clickhouse.database,
        ...config.clickhouse.options,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });
    }

    this.debug = config.debug ?? false;
  }

  /**
   * Initialize the query provider (ensures schema exists).
   */
  async init(): Promise<void> {
    const status = await checkSchemaStatus(this.client);
    if (!status.isInitialized) {
      await runMigrations(this.client);
    }
  }

  // ============================================================
  // Trace Queries
  // ============================================================

  /**
   * List traces with filtering and pagination.
   */
  async listTraces(options: TraceQueryOptions = {}): Promise<{ traces: Trace[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildTraceConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const [{ total }] = await countResult.json<{ total: number }>();

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY start_time DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const traces = rows.map(this.transformTrace);

    return {
      traces,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  /**
   * Get a single trace by ID.
   */
  async getTrace(traceId: string): Promise<Trace | null> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.TRACES} FINAL
      WHERE trace_id = {traceId:String}
      LIMIT 1
    `;

    const result = await this.client.query({
      query,
      query_params: { traceId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.length > 0 ? this.transformTrace(rows[0]) : null;
  }

  // ============================================================
  // Span Queries
  // ============================================================

  /**
   * List spans with filtering and pagination.
   */
  async listSpans(options: SpanQueryOptions = {}): Promise<{ spans: Span[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildSpanConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.SPANS} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const [{ total }] = await countResult.json<{ total: number }>();

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.SPANS} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY start_time DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const spans = rows.map(this.transformSpan);

    return {
      spans,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  /**
   * Get spans for a trace.
   */
  async getSpansForTrace(traceId: string): Promise<Span[]> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.SPANS} FINAL
      WHERE trace_id = {traceId:String}
      ORDER BY start_time ASC
    `;

    const result = await this.client.query({
      query,
      query_params: { traceId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    return rows.map(this.transformSpan);
  }

  // ============================================================
  // Log Queries
  // ============================================================

  /**
   * List logs with filtering and pagination.
   */
  async listLogs(options: LogQueryOptions = {}): Promise<{ logs: Log[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildLogConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.LOGS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const [{ total }] = await countResult.json<{ total: number }>();

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.LOGS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const logs = rows.map(this.transformLog);

    return {
      logs,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Metric Queries
  // ============================================================

  /**
   * List metrics with filtering and pagination.
   */
  async listMetrics(options: MetricQueryOptions = {}): Promise<{ metrics: Metric[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildMetricConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.METRICS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const [{ total }] = await countResult.json<{ total: number }>();

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.METRICS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const metrics = rows.map(this.transformMetric);

    return {
      metrics,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Score Queries
  // ============================================================

  /**
   * List scores with filtering and pagination.
   */
  async listScores(options: ScoreQueryOptions = {}): Promise<{ scores: Score[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildScoreConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.SCORES}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const [{ total }] = await countResult.json<{ total: number }>();

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.SCORES}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any>();
    const scores = rows.map(this.transformScore);

    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Analytics / Aggregation Queries
  // ============================================================

  /**
   * Get trace count over time.
   */
  async getTraceCountTimeSeries(
    options: AggregationOptions & { projectId?: string; deploymentId?: string },
  ): Promise<TimeBucket[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      intervalSeconds: options.intervalSeconds,
    };

    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }
    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }

    const query = `
      SELECT
        toStartOfInterval(start_time, INTERVAL {intervalSeconds:UInt32} SECOND) AS timestamp,
        count() AS count
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    const result = await this.client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
    });

    const rows = await result.json<{ timestamp: string; count: number }>();
    return rows.map(r => ({
      timestamp: new Date(r.timestamp),
      count: r.count,
    }));
  }

  /**
   * Get error rate over time.
   */
  async getErrorRateTimeSeries(
    options: AggregationOptions & { projectId?: string; deploymentId?: string },
  ): Promise<TimeBucket[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      intervalSeconds: options.intervalSeconds,
    };

    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }
    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }

    const query = `
      SELECT
        toStartOfInterval(start_time, INTERVAL {intervalSeconds:UInt32} SECOND) AS timestamp,
        count() AS count,
        countIf(status = 'error') AS error_count,
        error_count / count AS error_rate
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    const result = await this.client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
    });

    const rows = await result.json<{
      timestamp: string;
      count: number;
      error_count: number;
      error_rate: number;
    }>();

    return rows.map(r => ({
      timestamp: new Date(r.timestamp),
      count: r.count,
      values: {
        errorCount: r.error_count,
        errorRate: r.error_rate,
      },
    }));
  }

  // ============================================================
  // Condition Builders
  // ============================================================

  private buildTraceConditions(options: TraceQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.status) {
      conditions.push('status = {status:String}');
      params.status = options.status;
    }
    if (options.name) {
      conditions.push('name LIKE {name:String}');
      params.name = `%${options.name}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildSpanConditions(options: SpanQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.spanId) {
      conditions.push('span_id = {spanId:String}');
      params.spanId = options.spanId;
    }
    if (options.parentSpanId) {
      conditions.push('parent_span_id = {parentSpanId:String}');
      params.parentSpanId = options.parentSpanId;
    }
    if (options.kind) {
      conditions.push('kind = {kind:String}');
      params.kind = options.kind;
    }
    if (options.name) {
      conditions.push('name LIKE {name:String}');
      params.name = `%${options.name}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildLogConditions(options: LogQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.level) {
      conditions.push('level = {level:String}');
      params.level = options.level;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.spanId) {
      conditions.push('span_id = {spanId:String}');
      params.spanId = options.spanId;
    }
    if (options.message) {
      conditions.push('message LIKE {message:String}');
      params.message = `%${options.message}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildMetricConditions(options: MetricQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.name) {
      conditions.push('name = {name:String}');
      params.name = options.name;
    }
    if (options.type) {
      conditions.push('type = {type:String}');
      params.type = options.type;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildScoreConditions(options: ScoreQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.name) {
      conditions.push('name = {name:String}');
      params.name = options.name;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.minValue !== undefined) {
      conditions.push('value >= {minValue:Float64}');
      params.minValue = options.minValue;
    }
    if (options.maxValue !== undefined) {
      conditions.push('value <= {maxValue:Float64}');
      params.maxValue = options.maxValue;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  // ============================================================
  // Transform Functions
  // ============================================================

  private transformTrace(row: any): Trace {
    return {
      id: row.trace_id,
      projectId: row.project_id,
      deploymentId: row.deployment_id,
      name: row.name,
      status: row.status,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      durationMs: row.duration_ms,
      input: row.input ? JSON.parse(row.input) : undefined,
      output: row.output ? JSON.parse(row.output) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      recordedAt: row.recorded_at,
    };
  }

  private transformSpan(row: any): Span {
    return {
      id: row.span_id,
      traceId: row.trace_id,
      parentSpanId: row.parent_span_id || null,
      projectId: row.project_id,
      deploymentId: row.deployment_id,
      name: row.name,
      kind: row.kind,
      status: row.status,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      durationMs: row.duration_ms,
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      events: row.events ? JSON.parse(row.events) : [],
      recordedAt: row.recorded_at,
    };
  }

  private transformLog(row: any): Log {
    return {
      id: row.id,
      projectId: row.project_id,
      deploymentId: row.deployment_id,
      traceId: row.trace_id || null,
      spanId: row.span_id || null,
      level: row.level,
      message: row.message,
      timestamp: new Date(row.timestamp),
      attributes: row.attributes ? JSON.parse(row.attributes) : {},
      recordedAt: row.recorded_at,
    };
  }

  private transformMetric(row: any): Metric {
    return {
      id: row.id,
      projectId: row.project_id,
      deploymentId: row.deployment_id,
      name: row.name,
      type: row.type,
      value: row.value,
      unit: row.unit || null,
      timestamp: new Date(row.timestamp),
      labels: row.labels ? JSON.parse(row.labels) : {},
      recordedAt: row.recorded_at,
    };
  }

  private transformScore(row: any): Score {
    return {
      id: row.id,
      projectId: row.project_id,
      deploymentId: row.deployment_id,
      traceId: row.trace_id || null,
      name: row.name,
      value: row.value,
      normalizedValue: row.normalized_value,
      comment: row.comment || null,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      recordedAt: row.recorded_at,
    };
  }
}
```

---

### Phase 6: CLI

#### 6.1 Create cli/index.ts

**File**: `observability/clickhouse/src/cli/index.ts`

```typescript
#!/usr/bin/env node
/**
 * CLI for @mastra/observability-clickhouse
 */

import { Command } from 'commander';
import { ingestCommand } from './commands/ingest.js';
import { migrateCommand } from './commands/migrate.js';

const program = new Command();

program
  .name('mastra-observability-clickhouse')
  .description('ClickHouse ingestion worker and utilities for MastraAdmin observability')
  .version('0.0.1');

program.addCommand(ingestCommand);
program.addCommand(migrateCommand);

program.parse(process.argv);
```

#### 6.2 Create cli/commands/ingest.ts

**File**: `observability/clickhouse/src/cli/commands/ingest.ts`

```typescript
/**
 * Ingest command - runs the ingestion worker
 */

import { Command } from 'commander';
import { IngestionWorker } from '../../ingestion/worker.js';
import { LocalFileStorage } from '@mastra/observability-file-local';

export const ingestCommand = new Command('ingest')
  .description('Run the ingestion worker to process JSONL files into ClickHouse')
  .requiredOption('--clickhouse-url <url>', 'ClickHouse server URL (e.g., http://localhost:8123)')
  .option('--clickhouse-username <username>', 'ClickHouse username', 'default')
  .option('--clickhouse-password <password>', 'ClickHouse password', '')
  .option('--clickhouse-database <database>', 'ClickHouse database name')
  .requiredOption('--file-storage-type <type>', 'File storage type (local)', 'local')
  .option('--file-storage-path <path>', 'Base path for file storage (required for local)')
  .option('--base-path <path>', 'Base path within file storage for observability files', 'observability')
  .option('--poll-interval <ms>', 'Poll interval in milliseconds', '10000')
  .option('--batch-size <count>', 'Number of files to process per batch', '10')
  .option('--delete-after-process', 'Delete files after processing instead of moving to processed/')
  .option('--project-id <id>', 'Only process files for a specific project')
  .option('--once', 'Process files once and exit (for cron-based execution)')
  .option('--debug', 'Enable debug logging')
  .action(async options => {
    try {
      // Validate file storage options
      if (options.fileStorageType === 'local' && !options.fileStoragePath) {
        console.error('Error: --file-storage-path is required when --file-storage-type is local');
        process.exit(1);
      }

      // Create file storage
      let fileStorage;
      if (options.fileStorageType === 'local') {
        const { LocalFileStorage } = await import('@mastra/observability-file-local');
        fileStorage = new LocalFileStorage({
          baseDir: options.fileStoragePath,
        });
      } else {
        console.error(`Error: Unsupported file storage type: ${options.fileStorageType}`);
        process.exit(1);
      }

      // Create worker
      const worker = new IngestionWorker({
        fileStorage,
        clickhouse: {
          url: options.clickhouseUrl,
          username: options.clickhouseUsername,
          password: options.clickhousePassword,
          database: options.clickhouseDatabase,
        },
        basePath: options.basePath,
        pollIntervalMs: parseInt(options.pollInterval, 10),
        batchSize: parseInt(options.batchSize, 10),
        deleteAfterProcess: options.deleteAfterProcess ?? false,
        projectId: options.projectId,
        debug: options.debug ?? false,
      });

      // Initialize (run migrations)
      console.log('Initializing ClickHouse schema...');
      await worker.init();
      console.log('Schema initialized');

      if (options.once) {
        // Process once and exit
        console.log('Processing files once...');
        const result = await worker.processOnce();
        console.log(`Processed ${result.filesProcessed} files, ${result.eventsIngested} events`);
        if (result.errors.length > 0) {
          console.error(`Errors: ${result.errors.length}`);
          for (const error of result.errors) {
            console.error(`  - ${error.filePath}: ${error.message}`);
          }
        }
        process.exit(result.errors.length > 0 ? 1 : 0);
      } else {
        // Run continuously
        console.log('Starting ingestion worker...');
        console.log(`  ClickHouse URL: ${options.clickhouseUrl}`);
        console.log(`  File storage: ${options.fileStorageType} (${options.fileStoragePath || 'n/a'})`);
        console.log(`  Poll interval: ${options.pollInterval}ms`);
        console.log(`  Batch size: ${options.batchSize}`);

        // Handle shutdown signals
        const shutdown = async () => {
          console.log('\nShutting down...');
          await worker.stop();
          const status = worker.getStatus();
          console.log(`Total files processed: ${status.totalFilesProcessed}`);
          console.log(`Total events ingested: ${status.totalEventsIngested}`);
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        await worker.start();

        // Keep the process running
        await new Promise(() => {}); // Never resolves
      }
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  });
```

#### 6.3 Create cli/commands/migrate.ts

**File**: `observability/clickhouse/src/cli/commands/migrate.ts`

```typescript
/**
 * Migrate command - runs schema migrations
 */

import { Command } from 'commander';
import { createClient } from '@clickhouse/client';
import { runMigrations, checkSchemaStatus } from '../../schema/migrations.js';

export const migrateCommand = new Command('migrate')
  .description('Run ClickHouse schema migrations')
  .requiredOption('--clickhouse-url <url>', 'ClickHouse server URL (e.g., http://localhost:8123)')
  .option('--clickhouse-username <username>', 'ClickHouse username', 'default')
  .option('--clickhouse-password <password>', 'ClickHouse password', '')
  .option('--clickhouse-database <database>', 'ClickHouse database name')
  .option('--check', 'Only check migration status, do not run migrations')
  .action(async options => {
    try {
      const client = createClient({
        url: options.clickhouseUrl,
        username: options.clickhouseUsername,
        password: options.clickhousePassword,
        database: options.clickhouseDatabase,
      });

      if (options.check) {
        console.log('Checking schema status...');
        const status = await checkSchemaStatus(client);

        if (status.isInitialized) {
          console.log('✓ Schema is up to date');
        } else {
          console.log('✗ Schema needs migration');
          if (status.missingTables.length > 0) {
            console.log(`  Missing tables: ${status.missingTables.join(', ')}`);
          }
          if (status.missingViews.length > 0) {
            console.log(`  Missing views: ${status.missingViews.join(', ')}`);
          }
        }

        await client.close();
        process.exit(status.isInitialized ? 0 : 1);
      }

      console.log('Running migrations...');
      await runMigrations(client);
      console.log('✓ Migrations complete');

      await client.close();
      process.exit(0);
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }
  });
```

---

### Phase 7: Main Exports

#### 7.1 Create index.ts

**File**: `observability/clickhouse/src/index.ts`

```typescript
/**
 * @mastra/observability-clickhouse
 *
 * ClickHouse storage and ingestion worker for MastraAdmin observability data.
 *
 * @packageDocumentation
 */

// Schema
export { TABLE_NAMES, VIEW_NAMES } from './schema/index.js';
export {
  TRACES_TABLE_SQL,
  SPANS_TABLE_SQL,
  LOGS_TABLE_SQL,
  METRICS_TABLE_SQL,
  SCORES_TABLE_SQL,
  ALL_TABLES_SQL,
} from './schema/tables.js';
export { ALL_MATERIALIZED_VIEWS_SQL } from './schema/materialized-views.js';
export { runMigrations, checkSchemaStatus, dropAllTables } from './schema/migrations.js';

// Query Provider
export { ClickHouseQueryProvider } from './query-provider/index.js';

// Ingestion Worker
export { IngestionWorker } from './ingestion/index.js';
export { processFile, listPendingFiles, bulkInsert } from './ingestion/index.js';
export type { FileProcessingResult, ParsedEvent } from './ingestion/index.js';

// Types
export type {
  // Configuration
  ClickHouseConfig,
  IngestionWorkerConfig,
  QueryProviderConfig,

  // Worker types
  ProcessingResult,
  ProcessingError,
  WorkerStatus,

  // Query types
  TimeRangeFilter,
  PaginationOptions,
  PaginationInfo,
  ObservabilityFilters,
  TraceQueryOptions,
  SpanQueryOptions,
  LogQueryOptions,
  MetricQueryOptions,
  ScoreQueryOptions,
  TimeBucket,
  AggregationOptions,

  // Re-exports from @mastra/admin
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityEventType,
  FileStorageProvider,
  FileInfo,
} from './types.js';
```

---

### Phase 8: Tests

#### 8.1 Create ingestion/worker.test.ts

**File**: `observability/clickhouse/src/ingestion/worker.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IngestionWorker } from './worker.js';
import type { FileStorageProvider, FileInfo } from '../types.js';

// Mock file storage
function createMockFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  setFile: (path: string, content: string) => void;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'mock' as const,
    files,
    setFile: (path: string, content: string) => {
      files.set(path, Buffer.from(content, 'utf-8'));
    },

    async write(path: string, content: Buffer | string): Promise<void> {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
      files.set(path, buffer);
    },

    async read(path: string): Promise<Buffer> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },

    async list(prefix: string): Promise<FileInfo[]> {
      const result: FileInfo[] = [];
      for (const [path, content] of files) {
        if (path.startsWith(prefix) && !path.includes('/processed/')) {
          result.push({
            path,
            size: content.length,
            lastModified: new Date(),
          });
        }
      }
      return result;
    },

    async delete(path: string): Promise<void> {
      files.delete(path);
    },

    async move(from: string, to: string): Promise<void> {
      const content = files.get(from);
      if (content) {
        files.set(to, content);
        files.delete(from);
      }
    },

    async exists(path: string): Promise<boolean> {
      return files.has(path);
    },
  };
}

// Mock ClickHouse client
function createMockClickHouseClient() {
  const insertedRows: any[] = [];

  return {
    insertedRows,
    async insert(options: { table: string; values: any[]; format: string }) {
      insertedRows.push(...options.values);
    },
    async query(options: { query: string }) {
      // Return empty result for schema checks
      return {
        async json() {
          return [];
        },
      };
    },
    async command(options: { query: string }) {
      // No-op for DDL
    },
    async close() {},
  };
}

describe('IngestionWorker', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;
  let clickhouseClient: ReturnType<typeof createMockClickHouseClient>;
  let worker: IngestionWorker;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
    clickhouseClient = createMockClickHouseClient();
  });

  afterEach(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  describe('constructor', () => {
    it('should create worker with valid config', () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as any },
        debug: false,
      });

      expect(worker).toBeInstanceOf(IngestionWorker);
    });
  });

  describe('processOnce', () => {
    it('should return empty result when no files', async () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as any },
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(0);
      expect(result.eventsIngested).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should process JSONL files and insert events', async () => {
      // Add a test file
      const traceEvent = {
        type: 'trace',
        id: 'trace_1',
        projectId: 'proj_1',
        deploymentId: 'dep_1',
        name: 'test-trace',
        status: 'ok',
        startTime: '2025-01-23T12:00:00.000Z',
        endTime: '2025-01-23T12:00:01.000Z',
        recordedAt: '2025-01-23T12:00:01.000Z',
      };
      fileStorage.setFile(
        'observability/trace/proj_1/20250123T120000Z_abc123.jsonl',
        JSON.stringify(traceEvent) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as any },
        debug: false,
      });

      const result = await worker.processOnce();

      expect(result.filesProcessed).toBe(1);
      expect(result.eventsIngested).toBe(1);
      expect(result.eventsByType.trace).toBe(1);
      expect(clickhouseClient.insertedRows).toHaveLength(1);
    });

    it('should move processed files to processed directory', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123.jsonl';
      fileStorage.setFile(
        filePath,
        JSON.stringify({
          type: 'trace',
          id: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: '',
          endTime: '',
        }) + '\n',
      );

      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as any },
        deleteAfterProcess: false,
        debug: false,
      });

      await worker.processOnce();

      // Original file should be gone
      expect(await fileStorage.exists(filePath)).toBe(false);
      // Processed file should exist
      expect(await fileStorage.exists('observability/trace/proj_1/processed/20250123T120000Z_abc123.jsonl')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return initial status', () => {
      worker = new IngestionWorker({
        fileStorage,
        clickhouse: { client: clickhouseClient as any },
        debug: false,
      });

      const status = worker.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.isProcessing).toBe(false);
      expect(status.totalFilesProcessed).toBe(0);
      expect(status.totalEventsIngested).toBe(0);
    });
  });
});
```

---

### Phase 9: Documentation

#### 9.1 Create README.md

**File**: `observability/clickhouse/README.md`

````markdown
# @mastra/observability-clickhouse

ClickHouse storage and ingestion worker for MastraAdmin observability data.

## Installation

```bash
npm install @mastra/observability-clickhouse
```
````

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

````

#### 9.2 Create CHANGELOG.md

**File**: `observability/clickhouse/CHANGELOG.md`

```markdown
# @mastra/observability-clickhouse

## 0.0.1

### Features

- Initial release
- ClickHouse schema for traces, spans, logs, metrics, scores
- Materialized views for hourly aggregations
- `IngestionWorker` for processing JSONL files into ClickHouse
- `ClickHouseQueryProvider` for querying observability data
- CLI for running ingestion worker standalone
- Migration support with `migrate` command
````

---

## Success Criteria

### Automated Verification

- [ ] Package builds successfully: `pnpm build:lib` in `observability/clickhouse/`
- [ ] TypeScript type checking passes: `pnpm typecheck`
- [ ] All unit tests pass: `pnpm test`
- [ ] ESLint passes: `pnpm lint`

### Schema Verification

- [ ] All tables are created correctly in ClickHouse
- [ ] Materialized views are created and populate correctly
- [ ] TTL policies are applied (90 days for traces/spans/metrics/scores, 30 days for logs)
- [ ] Partition by month works correctly

### Ingestion Worker Verification

- [ ] Worker starts and polls for files at configured interval
- [ ] JSONL files are parsed correctly (handles errors gracefully)
- [ ] Events are bulk inserted into correct ClickHouse tables
- [ ] Processed files are moved to processed/ directory (or deleted if configured)
- [ ] Retry logic handles transient failures
- [ ] Worker stops gracefully on SIGINT/SIGTERM
- [ ] `processOnce()` works for cron-based execution
- [ ] Statistics are tracked correctly

### Query Provider Verification

- [ ] `listTraces()` returns paginated traces with filtering
- [ ] `getTrace()` returns a single trace by ID
- [ ] `listSpans()` returns paginated spans with filtering
- [ ] `getSpansForTrace()` returns all spans for a trace
- [ ] `listLogs()` returns paginated logs with filtering
- [ ] `listMetrics()` returns paginated metrics with filtering
- [ ] `listScores()` returns paginated scores with filtering
- [ ] Time series aggregation queries work correctly
- [ ] Error rate calculation is accurate

### CLI Verification

- [ ] `ingest` command starts worker with all options
- [ ] `ingest --once` processes and exits
- [ ] `migrate` command runs migrations
- [ ] `migrate --check` reports status without modifying
- [ ] Help text is accurate for all commands

### Integration Testing (with Docker)

- [ ] End-to-end test: write events → flush to file → ingest to ClickHouse → query back
- [ ] Large batch processing (10,000+ events)
- [ ] Error recovery (ClickHouse restart during processing)
- [ ] Concurrent worker instances don't process same files

---

## Implementation Checklist

### Phase 1: Package Setup

- [ ] Create `observability/clickhouse/` directory
- [ ] Create `package.json`
- [ ] Create `tsconfig.json`
- [ ] Create `tsup.config.ts`
- [ ] Create `vitest.config.ts`

### Phase 2: Core Types

- [ ] Create `src/types.ts`

### Phase 3: ClickHouse Schema

- [ ] Create `src/schema/tables.ts`
- [ ] Create `src/schema/materialized-views.ts`
- [ ] Create `src/schema/migrations.ts`
- [ ] Create `src/schema/index.ts`

### Phase 4: Ingestion Worker

- [ ] Create `src/ingestion/file-processor.ts`
- [ ] Create `src/ingestion/bulk-inserter.ts`
- [ ] Create `src/ingestion/worker.ts`
- [ ] Create `src/ingestion/index.ts`

### Phase 5: Query Provider

- [ ] Create `src/query-provider/index.ts`

### Phase 6: CLI

- [ ] Create `src/cli/index.ts`
- [ ] Create `src/cli/commands/ingest.ts`
- [ ] Create `src/cli/commands/migrate.ts`

### Phase 7: Main Exports

- [ ] Create `src/index.ts`

### Phase 8: Tests

- [ ] Create `src/ingestion/worker.test.ts`
- [ ] Create additional unit tests as needed

### Phase 9: Documentation

- [ ] Create `README.md`
- [ ] Create `CHANGELOG.md`

### Phase 10: Integration

- [ ] Add to `pnpm-workspace.yaml` if needed
- [ ] Add to turbo.json build dependencies if needed
- [ ] Verify builds from monorepo root
- [ ] Create Docker Compose setup for integration testing
