# Phase 9: MomentExporter

**Status:** Planning
**Prerequisites:** Phase 1-5
**Estimated Scope:** MomentExporter implementation, ClickHouse pulse_moments table

---

## Overview

Phase 9 implements the MomentExporter for Mastra Pulse - an internal event store approach for building a graph of moments:
- Moment schema (event store approach)
- MomentExporter implementation
- ClickHouse pulse_moments table

**Philosophy:** Rather than combining events into aggregated records, we capture individual events (span_started, span_ended, log_added, etc.) as moments with correlation IDs that enable graph-based analysis.

**Note:** MomentKind uses underscore notation (`span_started`, `span_ended`, etc.) to match the TracingEventType pattern used elsewhere in the codebase.

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 9.1 | `@mastra/core` | Moment types and interfaces |
| PR 9.2 | `observability/pulse` (new) | MomentExporter implementation |
| PR 9.3 | `stores/clickhouse` | pulse_moments table |

---

## PR 9.1: @mastra/core Moment Types

**Package:** `packages/core`
**Scope:** Moment types and interfaces

### 9.1.1 Moment Schema

**File:** `packages/core/src/observability/types/moment.ts` (new)

```typescript
import { z } from 'zod';

/**
 * MomentKind represents the type of event captured.
 * Using string (not enum) for extensibility - new kinds can be added
 * without schema migration.
 */
export const momentKindSchema = z.enum([
  // Span lifecycle
  'span_started',
  'span_ended',
  'span_updated',
  'span_error',

  // Scores and feedback
  'score_added',
  'feedback_added',

  // Logs
  'log_added',

  // Future extensibility (examples)
  // 'deploy_completed',
  // 'config_changed',
  // 'experiment_started',
  // 'experiment_ended',
]);

export type MomentKind = z.infer<typeof momentKindSchema>;

export const momentSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  kind: momentKindSchema,

  // Correlation IDs (for building the graph)
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),

  // Execution context
  runId: z.string().optional(),
  sessionId: z.string().optional(),
  threadId: z.string().optional(),
  requestId: z.string().optional(),

  // Multi-tenancy
  organizationId: z.string().optional(),
  userId: z.string().optional(),

  // Environment
  serviceName: z.string().optional(),
  environment: z.string().optional(),

  // Entity context
  entityType: z.string().optional(),
  entityName: z.string().optional(),

  // Event-specific payload (JSON stringified)
  payload: z.string().optional(),
});

export type Moment = z.infer<typeof momentSchema>;

export interface MomentInput {
  kind: MomentKind;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  requestId?: string;
  organizationId?: string;
  userId?: string;
  serviceName?: string;
  environment?: string;
  entityType?: string;
  entityName?: string;
  payload?: Record<string, unknown>;
}
```

**Notes:**
- `MomentKind` as string enum allows future extensibility
- Payload is JSON stringified for flexibility
- All correlation IDs included for graph building
- No `metric.recorded` - skipped per discussion

**Tasks:**
- [ ] Define MomentKind type
- [ ] Define Moment schema
- [ ] Define MomentInput interface
- [ ] Export from types index

### 9.1.2 Moment Storage Interface

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class (optional - for future)

// === Moments (experimental) ===
async batchCreateMoments?(args: BatchCreateMomentsArgs): Promise<void>;
async listMoments?(args: ListMomentsArgs): Promise<PaginatedResult<Moment>>;

// Types
export interface BatchCreateMomentsArgs {
  moments: Moment[];
}

export interface ListMomentsArgs {
  filters?: {
    kind?: MomentKind | MomentKind[];
    traceId?: string;
    spanId?: string;
    runId?: string;
    sessionId?: string;
    organizationId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  orderBy?: {
    field: 'timestamp';
    direction: 'asc' | 'desc';
  };
}
```

**Tasks:**
- [ ] Add optional moment methods to storage interface
- [ ] Define argument types

### PR 9.1 Testing

**Tasks:**
- [ ] Test Moment schema validation
- [ ] Verify type exports

---

## PR 9.2: MomentExporter Implementation

**Package:** `observability/pulse` (new package)
**Scope:** MomentExporter that captures individual events as moments

### 9.2.1 Package Setup

**Structure:**
```
observability/pulse/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── exporter.ts
│   ├── types.ts
│   └── converters/
│       ├── span.ts
│       ├── score.ts
│       ├── feedback.ts
│       └── log.ts
```

**Tasks:**
- [ ] Create package structure
- [ ] Set up package.json with dependencies
- [ ] Set up tsconfig.json

### 9.2.2 MomentExporter Configuration

**File:** `observability/pulse/src/types.ts`

```typescript
export interface MomentExporterConfig {
  // Target storage (ClickHouse only for now)
  clickhouseUrl: string;
  clickhouseDatabase?: string;

  // Multi-tenancy defaults
  organizationId?: string;

  // Batching
  batchSize?: number;
  flushIntervalMs?: number;

  // Which moments to capture (defaults to all)
  enabledKinds?: MomentKind[];
}
```

**Tasks:**
- [ ] Define config interface
- [ ] Define defaults

### 9.2.3 MomentExporter Implementation

**File:** `observability/pulse/src/exporter.ts`

```typescript
import {
  BaseExporter,
  TracingEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
  Moment,
  MomentKind,
  AnyExportedSpan,
} from '@mastra/core';
import { generateId } from './utils';

export class MomentExporter extends BaseExporter {
  readonly name = 'MomentExporter';
  // Handler presence = signal support
  // Note: No onMetricEvent - skipping metrics per discussion

  private buffer: Moment[] = [];
  private config: MomentExporterConfig;
  private client: ClickHouseClient;

  constructor(config: MomentExporterConfig) {
    super();
    this.config = {
      batchSize: 100,
      flushIntervalMs: 5000,
      ...config,
    };
    this.client = createClickHouseClient(config);

    // Auto-flush interval
    setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  async onTracingEvent(event: TracingEvent): Promise<void> {
    const moment = this.tracingEventToMoment(event);
    if (moment && this.isKindEnabled(moment.kind)) {
      this.buffer.push(moment);
      if (this.buffer.length >= this.config.batchSize!) {
        await this.flush();
      }
    }
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    if (!this.isKindEnabled('log_added')) return;

    const moment: Moment = {
      id: generateId(),
      timestamp: new Date(event.log.timestamp),
      kind: 'log_added',
      traceId: event.log.traceId,
      spanId: event.log.spanId,
      runId: event.log.runId,
      sessionId: event.log.sessionId,
      threadId: event.log.threadId,
      requestId: event.log.requestId,
      organizationId: event.log.organizationId ?? this.config.organizationId,
      userId: event.log.userId,
      serviceName: event.log.serviceName,
      environment: event.log.environment,
      entityType: event.log.entityType,
      entityName: event.log.entityName,
      payload: JSON.stringify({
        level: event.log.level,
        message: event.log.message,
        data: event.log.data,
      }),
    };

    this.buffer.push(moment);
    if (this.buffer.length >= this.config.batchSize!) {
      await this.flush();
    }
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (!this.isKindEnabled('score_added')) return;

    const moment: Moment = {
      id: generateId(),
      timestamp: new Date(event.score.timestamp),
      kind: 'score_added',
      traceId: event.score.traceId,
      spanId: event.score.spanId,
      organizationId: this.config.organizationId,
      payload: JSON.stringify({
        scorerName: event.score.scorerName,
        score: event.score.score,
        reason: event.score.reason,
        metadata: event.score.metadata,
      }),
    };

    this.buffer.push(moment);
    if (this.buffer.length >= this.config.batchSize!) {
      await this.flush();
    }
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    if (!this.isKindEnabled('feedback_added')) return;

    const moment: Moment = {
      id: generateId(),
      timestamp: new Date(event.feedback.timestamp),
      kind: 'feedback_added',
      traceId: event.feedback.traceId,
      spanId: event.feedback.spanId,
      userId: event.feedback.userId,
      organizationId: this.config.organizationId,
      payload: JSON.stringify({
        source: event.feedback.source,
        feedbackType: event.feedback.feedbackType,
        value: event.feedback.value,
        comment: event.feedback.comment,
        metadata: event.feedback.metadata,
      }),
    };

    this.buffer.push(moment);
    if (this.buffer.length >= this.config.batchSize!) {
      await this.flush();
    }
  }

  private tracingEventToMoment(event: TracingEvent): Moment | null {
    switch (event.type) {
      case 'span_started':
        return this.spanToMoment(event.span, 'span_started');
      case 'span_ended':
        return this.spanToMoment(event.span, 'span_ended');
      case 'span_updated':
        return this.spanToMoment(event.span, 'span_updated');
      case 'span_error':
        return this.spanToMoment(event.span, 'span_error', {
          error: event.error,
        });
      default:
        return null;
    }
  }

  private spanToMoment(
    span: AnyExportedSpan,
    kind: MomentKind,
    extraPayload?: Record<string, unknown>,
  ): Moment {
    return {
      id: generateId(),
      timestamp: kind === 'span_ended' ? new Date(span.endedAt ?? Date.now()) : new Date(span.startedAt ?? Date.now()),
      kind,
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId,
      runId: span.runId,
      sessionId: span.sessionId,
      threadId: span.threadId,
      requestId: span.requestId,
      organizationId: span.organizationId ?? this.config.organizationId,
      userId: span.userId,
      serviceName: span.serviceName,
      environment: span.environment,
      entityType: span.entityType,
      entityName: span.entityName,
      payload: JSON.stringify({
        name: span.name,
        type: span.type,
        status: span.status,
        ...extraPayload,
      }),
    };
  }

  private isKindEnabled(kind: MomentKind): boolean {
    if (!this.config.enabledKinds) return true;
    return this.config.enabledKinds.includes(kind);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const moments = this.buffer.splice(0);
    await this.client.insert({
      table: 'pulse_moments',
      values: moments.map(this.momentToRow),
      format: 'JSONEachRow',
    });
  }

  async shutdown(): Promise<void> {
    await this.flush();
    await this.client.close();
  }

  private momentToRow(moment: Moment): ClickHouseMomentRow {
    return {
      Id: moment.id,
      Timestamp: moment.timestamp.toISOString(),
      Kind: moment.kind,
      TraceId: moment.traceId ?? '',
      SpanId: moment.spanId ?? '',
      ParentSpanId: moment.parentSpanId ?? '',
      RunId: moment.runId ?? '',
      SessionId: moment.sessionId ?? '',
      ThreadId: moment.threadId ?? '',
      RequestId: moment.requestId ?? '',
      OrganizationId: moment.organizationId ?? '',
      UserId: moment.userId ?? '',
      ServiceName: moment.serviceName ?? '',
      Environment: moment.environment ?? '',
      EntityType: moment.entityType ?? '',
      EntityName: moment.entityName ?? '',
      Payload: moment.payload ?? '',
    };
  }
}
```

**Tasks:**
- [ ] Implement MomentExporter class
- [ ] Implement span → moment conversion
- [ ] Implement score → moment conversion
- [ ] Implement feedback → moment conversion
- [ ] Implement log → moment conversion
- [ ] Implement batching and flushing
- [ ] Support enabledKinds filtering

### 9.2.4 Export Index

**File:** `observability/pulse/src/index.ts`

```typescript
export { MomentExporter } from './exporter';
export type { MomentExporterConfig } from './types';
```

**Tasks:**
- [ ] Export MomentExporter
- [ ] Export types

### PR 9.2 Testing

**Tasks:**
- [ ] Test span_started moment creation
- [ ] Test span_ended moment creation
- [ ] Test score_added moment creation
- [ ] Test feedback_added moment creation
- [ ] Test log_added moment creation
- [ ] Test batching and flushing
- [ ] Test enabledKinds filtering

---

## PR 9.3: ClickHouse pulse_moments Table

**Package:** `stores/clickhouse`
**Scope:** Create pulse_moments table (standalone, not in ObservabilityStorage)

### 9.3.1 pulse_moments Table Schema

**File:** `stores/clickhouse/sql/pulse_moments.sql` (documentation/reference)

```sql
CREATE TABLE IF NOT EXISTS pulse_moments (
  Id String CODEC(ZSTD(1)),
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  Kind LowCardinality(String) CODEC(ZSTD(1)),

  -- Correlation IDs
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),
  ParentSpanId String CODEC(ZSTD(1)),

  -- Execution context
  RunId String CODEC(ZSTD(1)),
  SessionId String CODEC(ZSTD(1)),
  ThreadId String CODEC(ZSTD(1)),
  RequestId String CODEC(ZSTD(1)),

  -- Multi-tenancy
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  UserId String CODEC(ZSTD(1)),

  -- Environment
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),
  Environment LowCardinality(String) CODEC(ZSTD(1)),

  -- Entity context
  EntityType LowCardinality(String) CODEC(ZSTD(1)),
  EntityName LowCardinality(String) CODEC(ZSTD(1)),

  -- Event payload (JSON string)
  Payload String CODEC(ZSTD(1)),

  -- Indexes for graph queries
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_parent_span_id ParentSpanId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_org_id OrganizationId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_run_id RunId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_session_id SessionId TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (OrganizationId, Kind, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 90 DAY
```

**Design Notes:**
- `Kind` is `LowCardinality(String)` for extensibility - new kinds can be added without schema migration
- Multiple bloom filter indexes for graph traversal queries
- Partitioned by date for efficient time-based queries
- Ordered by (OrganizationId, Kind, Timestamp) for efficient org + kind queries
- 90-day default TTL

**Tasks:**
- [ ] Create table creation SQL
- [ ] Document schema for MomentExporter usage

### 9.3.2 Table Creation Utility

**File:** `observability/pulse/src/setup.ts` (optional utility)

```typescript
export async function createPulseMomentsTable(client: ClickHouseClient): Promise<void> {
  await client.query({
    query: `
      CREATE TABLE IF NOT EXISTS pulse_moments (
        -- ... schema from above
      )
    `,
  });
}
```

**Tasks:**
- [ ] Create setup utility for table creation
- [ ] Add to MomentExporter init if needed

### PR 9.3 Testing

**Tasks:**
- [ ] Test table creation
- [ ] Test MomentExporter writes to table
- [ ] Test graph queries (find all moments for a trace)
- [ ] Test correlation ID queries

---

## Graph Query Examples

Once moments are captured, various graph queries become possible:

### Find all moments for a trace

```sql
SELECT * FROM pulse_moments
WHERE TraceId = 'abc123'
ORDER BY Timestamp ASC
```

### Find span lifecycle (started → ended)

```sql
SELECT * FROM pulse_moments
WHERE SpanId = 'span456'
  AND Kind IN ('span_started', 'span_ended', 'span_error')
ORDER BY Timestamp ASC
```

### Find all logs within a span

```sql
SELECT * FROM pulse_moments
WHERE SpanId = 'span456'
  AND Kind = 'log_added'
ORDER BY Timestamp ASC
```

### Find all scores for a trace

```sql
SELECT * FROM pulse_moments
WHERE TraceId = 'abc123'
  AND Kind = 'score_added'
```

### Build span hierarchy

```sql
-- Get root spans
SELECT * FROM pulse_moments
WHERE Kind = 'span_started'
  AND ParentSpanId = ''
  AND OrganizationId = 'org1'
  AND Timestamp >= now() - INTERVAL 1 HOUR

-- Then recursively get children using ParentSpanId
```

### Session timeline

```sql
SELECT * FROM pulse_moments
WHERE SessionId = 'session789'
ORDER BY Timestamp ASC
```

---

## Future Extensibility

The moment system is designed for future extensibility:

### Adding New Moment Kinds

Simply add a new kind and emit it - no schema migration needed:

```typescript
// Future: Deployment moments
const deployMoment: Moment = {
  id: generateId(),
  timestamp: new Date(),
  kind: 'deploy_completed',  // New kind
  organizationId: 'org1',
  payload: JSON.stringify({
    version: '1.2.3',
    environment: 'production',
  }),
};
```

### Potential Future Kinds

- `deploy_started`, `deploy_completed`, `deploy_failed`
- `config_changed`
- `experiment_started`, `experiment_ended`
- `alert.triggered`
- `user.action` (for product analytics)

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Agent run creates span_started → span_ended moments
- [ ] E2E test: Tool call creates nested moments with correct parentSpanId
- [ ] E2E test: Score added creates score_added moment
- [ ] E2E test: Log creates log_added moment with correct spanId
- [ ] E2E test: Graph query returns full trace timeline
- [ ] E2E test: Session query returns all moments in session

---

## Dependencies Between PRs

```
PR 9.1 (@mastra/core types)
    ↓
PR 9.2 (observability/pulse) ← depends on core types
    ↓
PR 9.3 (ClickHouse table) ← depends on pulse exporter
```

**Merge order:** 9.1 → 9.2 → 9.3

---

## Definition of Done

- [ ] Moment types defined in @mastra/core
- [ ] MomentExporter implemented and working
- [ ] pulse_moments table created in ClickHouse
- [ ] All moment kinds captured correctly
- [ ] Graph queries working
- [ ] All tests pass
- [ ] Documentation for Pulse usage

---

## Open Questions

1. Should we add a DuckDB moments table for local development?
2. Should moments be queryable via Mastra API, or only direct ClickHouse access?
3. What retention policy for moments (currently 90 days)?
4. Should we capture metric.recorded moments in the future?
