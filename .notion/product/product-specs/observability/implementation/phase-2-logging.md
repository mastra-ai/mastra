# Phase 2: Logging

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 1.5 (Debug Exporters)
**Estimated Scope:** LoggerContext implementation, storage, exporters

---

## Overview

Phase 2 implements the structured logging system with automatic trace correlation:
- LoggerContext implementation with auto-correlation
- LogRecord schema and storage methods
- LogsBus → exporter routing
- Exporter support for logs signal

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 2.1 | `@mastra/core` | LogRecord schema, storage interface extensions |
| PR 2.2 | `@mastra/observability` | LoggerContext impl, LogsBus wiring, exporters |
| PR 2.3 | `stores/duckdb` | Logs table and methods |
| PR 2.4 | `stores/clickhouse` | Logs table and methods |

---

## PR 2.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** LogRecord schema, storage interface extensions

### 2.1.1 LogRecord Schema

**File:** `packages/core/src/observability/types/logs.ts` (new)

```typescript
import { z } from 'zod';

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof logLevelSchema>;

export const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  level: logLevelSchema,
  message: z.string(),
  data: z.record(z.unknown()).optional(),

  // Correlation (auto-captured from trace context)
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  runId: z.string().optional(),
  sessionId: z.string().optional(),
  threadId: z.string().optional(),
  requestId: z.string().optional(),

  // Entity context (auto-captured)
  entityType: z.string().optional(),
  entityName: z.string().optional(),

  // Multi-tenancy
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  resourceId: z.string().optional(),

  // Environment (from config)
  environment: z.string().optional(),
  serviceName: z.string().optional(),
  source: z.string().optional(),

  // Filtering
  tags: z.array(z.string()).optional(),
});

export type LogRecord = z.infer<typeof logRecordSchema>;

export interface LogRecordInput {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  tags?: string[];
}
```

**Tasks:**
- [ ] Define logLevelSchema enum
- [ ] Define logRecordSchema with all fields
- [ ] Define LogRecordInput for user-facing API
- [ ] Export from types index

### 2.1.2 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class

// === Logs ===
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  throw new Error('Not implemented');
}

// Types
export interface BatchCreateLogsArgs {
  logs: LogRecord[];
}

export interface ListLogsArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    runId?: string;
    sessionId?: string;
    level?: LogLevel | LogLevel[];
    entityType?: string;
    entityName?: string;
    userId?: string;
    organizationId?: string;
    serviceName?: string;
    environment?: string;
    startTime?: Date;
    endTime?: Date;
    search?: string;  // full-text search on message
    tags?: string[];
    dataKeys?: string[];  // filter logs that have specific data keys
  };
  pagination?: {
    limit?: number;
    offset?: number;
    cursor?: string;
  };
  orderBy?: {
    field: 'timestamp';
    direction: 'asc' | 'desc';
  };
}
```

**Tasks:**
- [ ] Add `batchCreateLogs()` method
- [ ] Add `listLogs()` method
- [ ] Define BatchCreateLogsArgs interface
- [ ] Define ListLogsArgs interface with filters
- [ ] Update capabilities type for logs support

### 2.1.3 Update StorageCapabilities

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
export interface StorageCapabilities {
  tracing: { /* existing */ };
  logs: {
    preferred: 'realtime' | 'insert-only';
    supported: ('realtime' | 'insert-only')[];
  };
  // ...
}
```

**Tasks:**
- [ ] Update logs capability to match pattern
- [ ] Ensure backward compat with boolean check

### PR 2.1 Testing

**Tasks:**
- [ ] Test LogRecord schema validation
- [ ] Test schema accepts valid records
- [ ] Test schema rejects invalid records
- [ ] Verify type exports

---

## PR 2.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** LoggerContext implementation, LogsBus wiring, exporter updates

### 2.2.1 LoggerContext Implementation

**File:** `observability/mastra/src/context/logger.ts` (new)

```typescript
import { LoggerContext, LogLevel, LogRecordInput, LogRecord } from '@mastra/core';
import { LogsBus } from '../bus/logs';
import { generateId } from '../utils/id';

export interface LoggerContextConfig {
  // Correlation (auto-captured)
  traceId?: string;
  spanId?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  requestId?: string;

  // Entity context
  entityType?: string;
  entityName?: string;

  // Multi-tenancy
  userId?: string;
  organizationId?: string;
  resourceId?: string;

  // Environment
  environment?: string;
  serviceName?: string;
  source?: string;

  // Bus for emission
  logsBus: LogsBus;

  // Minimum log level
  minLevel?: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class LoggerContextImpl implements LoggerContext {
  private config: LoggerContextConfig;

  constructor(config: LoggerContextConfig) {
    this.config = config;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const minLevel = this.config.minLevel ?? 'debug';
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) {
      return;
    }

    const record: LogRecord = {
      id: generateId(),
      timestamp: new Date(),
      level,
      message,
      data,

      // Correlation (from config)
      traceId: this.config.traceId,
      spanId: this.config.spanId,
      runId: this.config.runId,
      sessionId: this.config.sessionId,
      threadId: this.config.threadId,
      requestId: this.config.requestId,

      // Entity context
      entityType: this.config.entityType,
      entityName: this.config.entityName,

      // Multi-tenancy
      userId: this.config.userId,
      organizationId: this.config.organizationId,
      resourceId: this.config.resourceId,

      // Environment
      environment: this.config.environment,
      serviceName: this.config.serviceName,
      source: this.config.source,
    };

    this.config.logsBus.emit({ type: 'log', record });
  }
}
```

**Tasks:**
- [ ] Implement LoggerContextImpl class
- [ ] Auto-inject all correlation fields
- [ ] Support minimum log level filtering
- [ ] Emit to LogsBus

### 2.2.2 LoggerContext Factory

**File:** `observability/mastra/src/context/factory.ts` (modify or new)

```typescript
import { LoggerContextImpl, LoggerContextConfig } from './logger';
import { TracingContext } from '@mastra/core';

export function createLoggerContext(
  tracingContext: TracingContext,
  baseConfig: Omit<LoggerContextConfig, 'traceId' | 'spanId'>,
): LoggerContextImpl {
  const span = tracingContext.currentSpan;

  return new LoggerContextImpl({
    ...baseConfig,
    traceId: span?.traceId,
    spanId: span?.spanId,
  });
}
```

**Tasks:**
- [ ] Create factory that extracts trace correlation from TracingContext
- [ ] Ensure spanId updates when span changes

### 2.2.3 LogsBus Wiring

**File:** `observability/mastra/src/bus/logs.ts` (modify)

```typescript
import { LogEvent } from '@mastra/core';
import { BaseEventBus } from './base';

export class LogsBus extends BaseEventBus<LogEvent> {
  constructor(options?: { bufferSize?: number; flushIntervalMs?: number }) {
    super(options ?? { bufferSize: 100, flushIntervalMs: 1000 });
  }
}
```

**Tasks:**
- [ ] Ensure LogsBus is properly configured with defaults
- [ ] Add reasonable buffer size for logs (higher than traces)

### 2.2.4 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
// In createLoggerContext method
createLoggerContext(
  tracingContext: TracingContext,
  entityContext?: { entityType?: string; entityName?: string }
): LoggerContext {
  if (!this.logsBus) {
    return noOpLoggerContext;
  }

  return new LoggerContextImpl({
    traceId: tracingContext.currentSpan?.traceId,
    spanId: tracingContext.currentSpan?.spanId,
    runId: this.config.runId,
    sessionId: this.config.sessionId,
    threadId: this.config.threadId,
    userId: this.config.userId,
    organizationId: this.config.organizationId,
    environment: this.config.environment,
    serviceName: this.config.serviceName,
    entityType: entityContext?.entityType,
    entityName: entityContext?.entityName,
    logsBus: this.logsBus,
    minLevel: this.config.logLevel,
  });
}
```

**Tasks:**
- [ ] Add createLoggerContext method
- [ ] Wire LogsBus to exporters
- [ ] Pass config values for correlation

### 2.2.5 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
export class DefaultExporter extends BaseExporter {
  readonly supportsTraces = true;
  readonly supportsMetrics = false;
  readonly supportsLogs = true;  // NEW
  readonly supportsScores = true;
  readonly supportsFeedback = false;

  async onLogEvent(event: LogEvent): Promise<void> {
    if (!this.storage) return;

    await this.storage.batchCreateLogs({ logs: [event.record] });
  }
}
```

**Tasks:**
- [ ] Set `supportsLogs = true`
- [ ] Implement `onLogEvent` to write to storage
- [ ] Consider batching multiple logs

### 2.2.6 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
export class JsonExporter extends BaseExporter {
  readonly supportsTraces = true;
  readonly supportsMetrics = true;
  readonly supportsLogs = true;
  readonly supportsScores = true;
  readonly supportsFeedback = true;

  async onLogEvent(event: LogEvent): Promise<void> {
    this.output('log', event.record);
  }

  private output(type: string, data: unknown): void {
    console.log(JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      data,
    }, null, 2));
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent`
- [ ] Format output for readability

### 2.2.7 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists, modify)

**Tasks:**
- [ ] Set `supportsLogs = true`
- [ ] Implement `onLogEvent` to send to Mastra Cloud
- [ ] Include in Phase 2 or defer based on Cloud API readiness

### 2.2.8 Update GrafanaCloudExporter

**File:** `observability/grafana-cloud/src/exporter.ts` (from Phase 1.5)

**Tasks:**
- [ ] Implement `onLogEvent` for Loki push
- [ ] Use Loki push format from Phase 1.5 spec

### PR 2.2 Testing

**Tasks:**
- [ ] Test LoggerContextImpl emits to bus
- [ ] Test correlation fields are populated
- [ ] Test minimum log level filtering
- [ ] Test DefaultExporter writes logs
- [ ] Test JsonExporter outputs logs
- [ ] Integration test: tool logs appear with trace correlation

---

## PR 2.3: DuckDB Logs Support

**Package:** `stores/duckdb`
**Scope:** Logs table and storage methods

### 2.3.1 Logs Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_logs (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR NOT NULL,
  message TEXT NOT NULL,
  data JSON,

  -- Correlation
  trace_id VARCHAR,
  span_id VARCHAR,
  run_id VARCHAR,
  session_id VARCHAR,
  thread_id VARCHAR,
  request_id VARCHAR,

  -- Entity context
  entity_type VARCHAR,
  entity_name VARCHAR,

  -- Multi-tenancy
  user_id VARCHAR,
  organization_id VARCHAR,
  resource_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR,
  source VARCHAR,

  -- Filtering
  tags VARCHAR[]
);

CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON mastra_ai_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON mastra_ai_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON mastra_ai_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_entity ON mastra_ai_logs(entity_type, entity_name);
```

**Tasks:**
- [ ] Add logs table creation to `init()`
- [ ] Create indexes for common queries

### 2.3.2 Implement batchCreateLogs

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  const { logs } = args;
  if (logs.length === 0) return;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_logs (
      id, timestamp, level, message, data,
      trace_id, span_id, run_id, session_id, thread_id, request_id,
      entity_type, entity_name,
      user_id, organization_id, resource_id,
      environment, service_name, source,
      tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const log of logs) {
    stmt.run(
      log.id,
      log.timestamp.toISOString(),
      log.level,
      log.message,
      log.data ? JSON.stringify(log.data) : null,
      log.traceId ?? null,
      log.spanId ?? null,
      log.runId ?? null,
      log.sessionId ?? null,
      log.threadId ?? null,
      log.requestId ?? null,
      log.entityType ?? null,
      log.entityName ?? null,
      log.userId ?? null,
      log.organizationId ?? null,
      log.resourceId ?? null,
      log.environment ?? null,
      log.serviceName ?? null,
      log.source ?? null,
      log.tags ? JSON.stringify(log.tags) : null,
    );
  }
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Handle JSON serialization for data and tags
- [ ] Consider transaction for batch

### 2.3.3 Implement listLogs

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_logs WHERE 1=1';
  const params: unknown[] = [];

  // Apply filters
  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.spanId) {
    query += ' AND span_id = ?';
    params.push(filters.spanId);
  }
  if (filters?.level) {
    const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
    query += ` AND level IN (${levels.map(() => '?').join(', ')})`;
    params.push(...levels);
  }
  if (filters?.entityType) {
    query += ' AND entity_type = ?';
    params.push(filters.entityType);
  }
  if (filters?.entityName) {
    query += ' AND entity_name = ?';
    params.push(filters.entityName);
  }
  if (filters?.startTime) {
    query += ' AND timestamp >= ?';
    params.push(filters.startTime.toISOString());
  }
  if (filters?.endTime) {
    query += ' AND timestamp <= ?';
    params.push(filters.endTime.toISOString());
  }
  if (filters?.search) {
    query += ' AND message LIKE ?';
    params.push(`%${filters.search}%`);
  }
  // ... more filters

  // Order
  const order = orderBy?.direction ?? 'desc';
  query += ` ORDER BY timestamp ${order}`;

  // Pagination
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToLogRecord),
    pagination: {
      total: this.getLogCount(filters),
      limit,
      offset,
    },
  };
}

private rowToLogRecord(row: any): LogRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    level: row.level,
    message: row.message,
    data: row.data ? JSON.parse(row.data) : undefined,
    traceId: row.trace_id ?? undefined,
    spanId: row.span_id ?? undefined,
    // ... map all fields
  };
}
```

**Tasks:**
- [ ] Implement listLogs with all filter support
- [ ] Add pagination
- [ ] Add ordering
- [ ] Map rows to LogRecord

### 2.3.4 Update Capabilities

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { preferred: 'realtime', supported: ['realtime', 'batch-with-updates'] },
    logs: { preferred: 'realtime', supported: ['realtime'] },
    metrics: { supported: false },
    scores: { supported: false },
    feedback: { supported: false },
  };
}
```

**Tasks:**
- [ ] Set logs capability to supported

### PR 2.3 Testing

**Tasks:**
- [ ] Test logs table creation
- [ ] Test batchCreateLogs inserts correctly
- [ ] Test listLogs with various filters
- [ ] Test pagination
- [ ] Test data JSON round-trip

---

## PR 2.4: ClickHouse Logs Support

**Package:** `stores/clickhouse`
**Scope:** Logs table and storage methods

### 2.4.1 Logs Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_logs (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  LogId String CODEC(ZSTD(1)),
  Level LowCardinality(String) CODEC(ZSTD(1)),
  Message String CODEC(ZSTD(1)),
  Data Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  -- Correlation
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),
  RunId String CODEC(ZSTD(1)),
  SessionId String CODEC(ZSTD(1)),
  ThreadId String CODEC(ZSTD(1)),
  RequestId String CODEC(ZSTD(1)),

  -- Entity context
  EntityType LowCardinality(String) CODEC(ZSTD(1)),
  EntityName LowCardinality(String) CODEC(ZSTD(1)),

  -- Multi-tenancy
  UserId String CODEC(ZSTD(1)),
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  ResourceId String CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),
  Source LowCardinality(String) CODEC(ZSTD(1)),

  -- Filtering
  Tags Array(String) CODEC(ZSTD(1)),

  -- Indexes for efficient queries
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_run_id RunId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_data_key mapKeys(Data) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_data_value mapValues(Data) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_message Message TYPE tokenbf_v1(10240, 3, 0) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Level, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 30 DAY
```

**Notes:**
- `Map(LowCardinality(String), String)` for `Data` allows searching/filtering on data keys/values
- `bloom_filter` indexes on `mapKeys(Data)` and `mapValues(Data)` enable filtering on specific data fields
- `tokenbf_v1` index on `Message` enables full-text search
- `LowCardinality` for known low-cardinality fields
- 30-day TTL default (configurable)

**Tasks:**
- [ ] Add logs table creation to `init()`
- [ ] Use ClickHouse-optimized types
- [ ] Add bloom filter indexes for efficient queries

### 2.4.2 Implement batchCreateLogs

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
  const { logs } = args;
  if (logs.length === 0) return;

  const rows = logs.map(log => ({
    Timestamp: log.timestamp.toISOString(),
    LogId: log.id,
    Level: log.level,
    Message: log.message,
    Data: this.objectToMap(log.data ?? {}),
    TraceId: log.traceId ?? '',
    SpanId: log.spanId ?? '',
    RunId: log.runId ?? '',
    SessionId: log.sessionId ?? '',
    ThreadId: log.threadId ?? '',
    RequestId: log.requestId ?? '',
    EntityType: log.entityType ?? '',
    EntityName: log.entityName ?? '',
    UserId: log.userId ?? '',
    OrganizationId: log.organizationId ?? '',
    ResourceId: log.resourceId ?? '',
    Environment: log.environment ?? '',
    ServiceName: log.serviceName ?? '',
    Source: log.source ?? '',
    Tags: log.tags ?? [],
  }));

  await this.client.insert({
    table: 'mastra_ai_logs',
    values: rows,
    format: 'JSONEachRow',
  });
}

private objectToMap(obj: Record<string, unknown>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    map[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return map;
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Convert data object to Map format
- [ ] Use JSONEachRow format

### 2.4.3 Implement listLogs

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async listLogs(args: ListLogsArgs): Promise<PaginatedResult<LogRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_logs WHERE 1=1';
  const params: Record<string, unknown> = {};

  // Apply filters
  if (filters?.traceId) {
    query += ' AND TraceId = {traceId:String}';
    params.traceId = filters.traceId;
  }
  if (filters?.level) {
    const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
    query += ` AND Level IN ({levels:Array(String)})`;
    params.levels = levels;
  }
  if (filters?.startTime) {
    query += ' AND Timestamp >= {startTime:DateTime64(9)}';
    params.startTime = filters.startTime.toISOString();
  }
  if (filters?.endTime) {
    query += ' AND Timestamp <= {endTime:DateTime64(9)}';
    params.endTime = filters.endTime.toISOString();
  }
  if (filters?.search) {
    query += ' AND hasToken(Message, {search:String})';
    params.search = filters.search;
  }
  if (filters?.dataKeys) {
    // Filter logs that have specific keys in Data map
    for (const key of filters.dataKeys) {
      query += ` AND mapContains(Data, {dataKey_${key}:String})`;
      params[`dataKey_${key}`] = key;
    }
  }

  // Order
  const order = orderBy?.direction ?? 'DESC';
  query += ` ORDER BY Timestamp ${order}`;

  // Pagination
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = limit;
  params.offset = offset;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseLogRow[]>();

  return {
    data: rows.map(this.rowToLogRecord.bind(this)),
    pagination: {
      total: await this.getLogCount(filters),
      limit,
      offset,
    },
  };
}

private rowToLogRecord(row: ClickHouseLogRow): LogRecord {
  return {
    id: row.LogId,
    timestamp: new Date(row.Timestamp),
    level: row.Level as LogLevel,
    message: row.Message,
    data: this.mapToObject(row.Data),
    traceId: row.TraceId || undefined,
    spanId: row.SpanId || undefined,
    // ... map all fields
  };
}

private mapToObject(map: Record<string, string>): Record<string, unknown> | undefined {
  if (!map || Object.keys(map).length === 0) return undefined;

  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(map)) {
    try {
      obj[key] = JSON.parse(value);
    } catch {
      obj[key] = value;
    }
  }
  return obj;
}
```

**Tasks:**
- [ ] Implement listLogs with ClickHouse query syntax
- [ ] Support filtering on Data map keys
- [ ] Support full-text search on Message
- [ ] Map rows to LogRecord

### 2.4.4 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { preferred: 'insert-only', supported: ['insert-only'] },
    logs: { preferred: 'insert-only', supported: ['insert-only'] },
    metrics: { supported: false },
    scores: { supported: false },
    feedback: { supported: false },
  };
}
```

**Tasks:**
- [ ] Set logs capability to supported

### PR 2.4 Testing

**Tasks:**
- [ ] Test logs table creation
- [ ] Test batchCreateLogs inserts correctly
- [ ] Test listLogs with various filters
- [ ] Test Data map filtering
- [ ] Test full-text search
- [ ] Test pagination

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Log from tool, verify trace correlation
- [ ] E2E test: Log from workflow step, verify trace correlation
- [ ] E2E test: Logs appear in DefaultExporter storage
- [ ] E2E test: Logs appear in JsonExporter output
- [ ] E2E test: Filter logs by trace ID
- [ ] E2E test: Search logs by message content

---

## Dependencies Between PRs

```
PR 2.1 (@mastra/core)
    ↓
PR 2.2 (@mastra/observability) ← depends on core types
    ↓
PR 2.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 2.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 2.3 and PR 2.4 can be done in parallel after PR 2.2.

**Merge order:** 2.1 → 2.2 → (2.3 | 2.4)

---

## Definition of Done

- [ ] LoggerContext implementation complete
- [ ] Logs emitted from tools/workflows have trace correlation
- [ ] DefaultExporter writes logs to storage
- [ ] JsonExporter outputs logs
- [ ] DuckDB adapter stores and retrieves logs
- [ ] ClickHouse adapter stores and retrieves logs
- [ ] All tests pass
- [ ] Documentation updated

---

## Open Questions

1. Should we add a `mastra.logger` direct API for logging outside trace context?
2. What should the default log retention be for ClickHouse?
3. Should we support structured logging format standards (like OpenTelemetry Logs)?
