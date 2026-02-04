# Phase 4: Scores & Feedback

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Logging), Phase 3 (Metrics)
**Estimated Scope:** Score/Feedback APIs, storage, exporter support

---

## Overview

Phase 4 implements the scores and feedback system:
- `span.addScore()` / `span.addFeedback()` APIs
- `trace.addScore()` / `trace.addFeedback()` APIs
- `mastra.getTrace(traceId)` for post-hoc attachment
- Score/Feedback schemas and storage methods
- ScoreEvent and FeedbackEvent emission to exporters
- Exporter support via `onScoreEvent()` / `onFeedbackEvent()`

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 4.1 | `@mastra/core` | Score/Feedback schemas, storage interface, APIs |
| PR 4.2 | `@mastra/observability` | Span/Trace implementations, ScoreEvent/FeedbackEvent emission |
| PR 4.3 | `stores/duckdb` | Scores/Feedback tables and methods |
| PR 4.4 | `stores/clickhouse` | Scores/Feedback tables and methods |

---

## PR 4.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** Score/Feedback schemas, storage interface, Span/Trace API definitions

### 4.1.1 Score Schema

**File:** `packages/core/src/observability/types/scores.ts` (new)

```typescript
import { z } from 'zod';

export const scoreInputSchema = z.object({
  scorerName: z.string(),
  score: z.number(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),  // For grouping scores by experiment
});

export type ScoreInput = z.infer<typeof scoreInputSchema>;

export const scoreRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),

  // Target
  traceId: z.string(),
  spanId: z.string().optional(),

  // Score data
  scorerName: z.string(),
  score: z.number(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),

  // Multi-tenancy
  organizationId: z.string().optional(),
  userId: z.string().optional(),

  // Environment
  environment: z.string().optional(),
  serviceName: z.string().optional(),
});

export type ScoreRecord = z.infer<typeof scoreRecordSchema>;
```

**Notes:**
- Score range is defined on the scorer, not in the score result
- `experiment` field for grouping scores (e.g., A/B tests, eval runs)

**Tasks:**
- [ ] Define ScoreInput schema (user-facing)
- [ ] Define ScoreRecord schema (storage)
- [ ] Export from types index

**TODO:** Verify alignment with existing evals scores schema.

### 4.1.2 Feedback Schema

**File:** `packages/core/src/observability/types/feedback.ts` (new)

```typescript
import { z } from 'zod';

export const feedbackInputSchema = z.object({
  source: z.string(),           // e.g., 'user', 'system', 'manual'
  feedbackType: z.string(),     // e.g., 'thumbs', 'rating', 'correction'
  value: z.union([z.number(), z.string()]),
  comment: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),

  // Target
  traceId: z.string(),
  spanId: z.string().optional(),

  // Feedback data
  source: z.string(),
  feedbackType: z.string(),
  value: z.union([z.number(), z.string()]),
  comment: z.string().optional(),
  experiment: z.string().optional(),

  // Attribution
  userId: z.string().optional(),

  // Multi-tenancy
  organizationId: z.string().optional(),

  // Environment
  environment: z.string().optional(),
  serviceName: z.string().optional(),

  // Extra
  metadata: z.record(z.unknown()).optional(),
});

export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;
```

**Notes:**
- `feedbackType` is flexible string (not enum) to support various feedback types
- `value` can be number (rating) or string (correction text)

**Tasks:**
- [ ] Define FeedbackInput schema (user-facing)
- [ ] Define FeedbackRecord schema (storage)
- [ ] Export from types index

**TODO:** Revisit table name `mastra_ai_trace_feedback`.

### 4.1.3 Update Span Interface

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

```typescript
export interface Span {
  // Existing properties...
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;

  // Existing methods...
  setStatus(status: SpanStatus): void;
  setAttribute(key: string, value: AttributeValue): void;
  addEvent(name: string, attributes?: Record<string, AttributeValue>): void;
  end(): void;

  // NEW: Score and Feedback
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}
```

**Tasks:**
- [ ] Add `addScore()` to Span interface
- [ ] Add `addFeedback()` to Span interface

### 4.1.4 Add Trace Interface

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

```typescript
export interface Trace {
  readonly traceId: string;
  readonly spans: ReadonlyArray<Span>;

  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
  getSpan(spanId: string): Span | null;
}
```

**Tasks:**
- [ ] Define Trace interface
- [ ] Export from types index

### 4.1.5 Add Mastra.getTrace() API

**File:** `packages/core/src/mastra/types.ts` (modify)

```typescript
export interface Mastra {
  // Existing...

  // NEW: Trace retrieval for post-hoc score/feedback attachment
  getTrace(traceId: string): Promise<Trace | null>;
}
```

**Tasks:**
- [ ] Add `getTrace()` to Mastra interface

### 4.1.6 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class

// === Scores ===
async createScore(args: CreateScoreArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  throw new Error('Not implemented');
}

// === Feedback ===
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  throw new Error('Not implemented');
}

// Types
export interface CreateScoreArgs {
  score: ScoreRecord;
}

export interface ListScoresArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    scorerName?: string | string[];
    experiment?: string;
    organizationId?: string;
    startTime?: Date;
    endTime?: Date;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  orderBy?: {
    field: 'timestamp' | 'score';
    direction: 'asc' | 'desc';
  };
}

export interface CreateFeedbackArgs {
  feedback: FeedbackRecord;
}

export interface ListFeedbackArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    feedbackType?: string | string[];
    source?: string;
    experiment?: string;
    userId?: string;
    organizationId?: string;
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
- [ ] Add `createScore()` method
- [ ] Add `listScores()` method
- [ ] Add `createFeedback()` method
- [ ] Add `listFeedback()` method
- [ ] Define all argument interfaces

### 4.1.7 Update StorageCapabilities

```typescript
export interface StorageCapabilities {
  tracing: { /* existing */ };
  logs: { /* existing */ };
  metrics: { /* existing */ };
  scores: { supported: boolean };
  feedback: { supported: boolean };
}
```

**Tasks:**
- [ ] Ensure scores/feedback capabilities are defined

### PR 4.1 Testing

**Tasks:**
- [ ] Test ScoreInput/ScoreRecord schema validation
- [ ] Test FeedbackInput/FeedbackRecord schema validation
- [ ] Verify type exports

---

## PR 4.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** Span/Trace implementations, score/feedback emission, exporter updates

**Note:** The `ObservabilityBus` was created in Phase 1 and already handles all event types (TracingEvent, MetricEvent, LogEvent). This phase adds ScoreEvent and FeedbackEvent to the existing bus.

### 4.2.1 Update Span Implementation

**File:** `observability/mastra/src/spans/span.ts` (modify)

```typescript
import { Span, ScoreInput, FeedbackInput, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class SpanImpl implements Span {
  constructor(
    private data: SpanData,
    private bus: ObservabilityBus,
  ) {}

  // Existing properties and methods...

  addScore(score: ScoreInput): void {
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: this.spanId,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: this.spanId,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement `addScore()` on SpanImpl
- [ ] Implement `addFeedback()` on SpanImpl
- [ ] Emit ScoreEvent/FeedbackEvent via ObservabilityBus

### 4.2.2 Update NoOp Span

**File:** `observability/mastra/src/spans/no-op.ts` (modify)

```typescript
export const noOpSpan: Span = {
  // Existing no-op implementations...

  addScore(score: ScoreInput): void {
    // No-op
  },

  addFeedback(feedback: FeedbackInput): void {
    // No-op
  },
};
```

**Tasks:**
- [ ] Add no-op `addScore()` and `addFeedback()`

### 4.2.3 Implement Trace Class

**File:** `observability/mastra/src/traces/trace.ts` (new)

```typescript
import { Trace, Span, ScoreInput, FeedbackInput, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class TraceImpl implements Trace {
  constructor(
    public readonly traceId: string,
    private _spans: Map<string, Span>,
    private bus: ObservabilityBus,
  ) {}

  get spans(): ReadonlyArray<Span> {
    return Array.from(this._spans.values());
  }

  getSpan(spanId: string): Span | null {
    return this._spans.get(spanId) ?? null;
  }

  addScore(score: ScoreInput): void {
    // Score at trace level (no spanId)
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: undefined,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    // Feedback at trace level (no spanId)
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: undefined,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement TraceImpl class
- [ ] Support trace-level scores (no spanId)
- [ ] Support trace-level feedback (no spanId)
- [ ] Implement getSpan()

### 4.2.4 Implement Mastra.getTrace()

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
async getTrace(traceId: string): Promise<Trace | null> {
  if (!this.storage) {
    return null;
  }

  // Fetch all spans for the trace
  const result = await this.storage.listTraces({
    filters: { traceId },
    pagination: { limit: 1000 },  // Reasonable max spans per trace
  });

  if (result.data.length === 0) {
    return null;
  }

  // Build span map
  const spanMap = new Map<string, Span>();
  for (const spanData of result.data) {
    const span = this.createSpanFromRecord(spanData);
    spanMap.set(spanData.id, span);
  }

  return new TraceImpl(traceId, spanMap, this.observabilityBus);
}

private createSpanFromRecord(record: SpanRecord): Span {
  // Create a "historical" span that can still emit events
  return new HistoricalSpanImpl(record, this.observabilityBus);
}
```

**Tasks:**
- [ ] Implement getTrace() on BaseObservabilityInstance
- [ ] Fetch spans from storage
- [ ] Build TraceImpl with spans

### 4.2.5 Historical Span Implementation

**File:** `observability/mastra/src/spans/historical.ts` (new)

```typescript
import { Span, ScoreInput, FeedbackInput, SpanRecord, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

/**
 * A span loaded from storage that can still receive scores/feedback
 * but cannot be modified (already ended).
 */
export class HistoricalSpanImpl implements Span {
  constructor(
    private record: SpanRecord,
    private bus: ObservabilityBus,
  ) {}

  get traceId(): string { return this.record.traceId; }
  get spanId(): string { return this.record.id; }
  get name(): string { return this.record.name; }

  // Status methods throw - span already ended
  setStatus(): void {
    throw new Error('Cannot modify historical span');
  }

  setAttribute(): void {
    throw new Error('Cannot modify historical span');
  }

  addEvent(): void {
    throw new Error('Cannot modify historical span');
  }

  end(): void {
    throw new Error('Historical span already ended');
  }

  // Score/Feedback work on historical spans
  addScore(score: ScoreInput): void {
    const event: ScoreEvent = {
      type: 'score',
      traceId: this.traceId,
      spanId: this.spanId,
      score,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }

  addFeedback(feedback: FeedbackInput): void {
    const event: FeedbackEvent = {
      type: 'feedback',
      traceId: this.traceId,
      spanId: this.spanId,
      feedback,
      timestamp: new Date(),
    };
    this.bus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement HistoricalSpanImpl
- [ ] Throw on modification methods
- [ ] Allow addScore/addFeedback

### 4.2.6 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
export class DefaultExporter extends BaseExporter {
  // Handler presence = signal support (no flags needed)

  async onTracingEvent(event: TracingEvent): Promise<void> {
    // Handle span events only (span.started, span.updated, span.ended, span.error)
    // Existing span handling...
  }

  // NEW: Separate handler for score events
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (!this.storage) return;

    const record: ScoreRecord = {
      id: generateId(),
      timestamp: event.timestamp,
      traceId: event.traceId,
      spanId: event.spanId,
      scorerName: event.score.scorerName,
      score: event.score.score,
      reason: event.score.reason,
      metadata: event.score.metadata,
      experiment: event.score.experiment,
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };

    await this.storage.createScore({ score: record });
  }

  // NEW: Separate handler for feedback events
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    if (!this.storage) return;

    const record: FeedbackRecord = {
      id: generateId(),
      timestamp: event.timestamp,
      traceId: event.traceId,
      spanId: event.spanId,
      source: event.feedback.source,
      feedbackType: event.feedback.feedbackType,
      value: event.feedback.value,
      comment: event.feedback.comment,
      experiment: event.feedback.experiment,
      userId: event.feedback.userId,
      metadata: event.feedback.metadata,
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };

    await this.storage.createFeedback({ feedback: record });
  }
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Write to storage

### 4.2.7 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
// Handler presence = signal support

async onTracingEvent(event: TracingEvent): Promise<void> {
  // Existing span output
  this.output('span', event.exportedSpan);
}

async onScoreEvent(event: ScoreEvent): Promise<void> {
  this.output('score', {
    traceId: event.traceId,
    spanId: event.spanId,
    timestamp: event.timestamp.toISOString(),
    ...event.score,
  });
}

async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  this.output('feedback', {
    traceId: event.traceId,
    spanId: event.spanId,
    timestamp: event.timestamp.toISOString(),
    ...event.feedback,
  });
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler

### 4.2.8 Update CloudExporter

**File:** `observability/cloud/src/exporter.ts` (if exists)

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Send to Mastra Cloud API

### PR 4.2 Testing

**Tasks:**
- [ ] Test span.addScore() emits event
- [ ] Test span.addFeedback() emits event
- [ ] Test trace.addScore() emits event (no spanId)
- [ ] Test trace.addFeedback() emits event (no spanId)
- [ ] Test mastra.getTrace() returns Trace with spans
- [ ] Test historical span allows scores/feedback
- [ ] Test historical span throws on modification
- [ ] Test DefaultExporter writes scores
- [ ] Test DefaultExporter writes feedback

---

## PR 4.3: DuckDB Scores/Feedback Support

**Package:** `stores/duckdb`
**Scope:** Scores and Feedback tables and methods

### 4.3.1 Scores Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_scores (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,

  -- Target
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR,

  -- Score data
  scorer_name VARCHAR NOT NULL,
  score DOUBLE NOT NULL,
  reason TEXT,
  metadata JSON,
  experiment VARCHAR,

  -- Multi-tenancy
  organization_id VARCHAR,
  user_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_scores_trace_id ON mastra_ai_scores(trace_id);
CREATE INDEX IF NOT EXISTS idx_scores_span_id ON mastra_ai_scores(span_id);
CREATE INDEX IF NOT EXISTS idx_scores_scorer ON mastra_ai_scores(scorer_name);
CREATE INDEX IF NOT EXISTS idx_scores_experiment ON mastra_ai_scores(experiment);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON mastra_ai_scores(timestamp DESC);
```

**Tasks:**
- [ ] Add scores table creation to `init()`
- [ ] Create indexes

### 4.3.2 Feedback Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_feedback (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,

  -- Target
  trace_id VARCHAR NOT NULL,
  span_id VARCHAR,

  -- Feedback data
  source VARCHAR NOT NULL,
  feedback_type VARCHAR NOT NULL,
  value VARCHAR NOT NULL,  -- Store as string, parse on read
  comment TEXT,
  experiment VARCHAR,

  -- Attribution
  user_id VARCHAR,

  -- Multi-tenancy
  organization_id VARCHAR,

  -- Environment
  environment VARCHAR,
  service_name VARCHAR,

  -- Extra
  metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_feedback_trace_id ON mastra_ai_feedback(trace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_span_id ON mastra_ai_feedback(span_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON mastra_ai_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_experiment ON mastra_ai_feedback(experiment);
CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON mastra_ai_feedback(timestamp DESC);
```

**Tasks:**
- [ ] Add feedback table creation to `init()`
- [ ] Create indexes

### 4.3.3 Implement createScore

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async createScore(args: CreateScoreArgs): Promise<void> {
  const { score } = args;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_scores (
      id, timestamp, trace_id, span_id,
      scorer_name, score, reason, metadata, experiment,
      organization_id, user_id, environment, service_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    score.id,
    score.timestamp.toISOString(),
    score.traceId,
    score.spanId ?? null,
    score.scorerName,
    score.score,
    score.reason ?? null,
    score.metadata ? JSON.stringify(score.metadata) : null,
    score.experiment ?? null,
    score.organizationId ?? null,
    score.userId ?? null,
    score.environment ?? null,
    score.serviceName ?? null,
  );
}
```

**Tasks:**
- [ ] Implement createScore

### 4.3.4 Implement listScores

```typescript
async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_scores WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.spanId) {
    query += ' AND span_id = ?';
    params.push(filters.spanId);
  }
  if (filters?.scorerName) {
    const names = Array.isArray(filters.scorerName) ? filters.scorerName : [filters.scorerName];
    query += ` AND scorer_name IN (${names.map(() => '?').join(', ')})`;
    params.push(...names);
  }
  if (filters?.experiment) {
    query += ' AND experiment = ?';
    params.push(filters.experiment);
  }
  // ... more filters

  const order = orderBy?.direction ?? 'desc';
  const field = orderBy?.field === 'score' ? 'score' : 'timestamp';
  query += ` ORDER BY ${field} ${order}`;

  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToScoreRecord),
    pagination: { total: this.getScoreCount(filters), limit, offset },
  };
}
```

**Tasks:**
- [ ] Implement listScores with filters
- [ ] Support ordering by score or timestamp

### 4.3.5 Implement createFeedback

```typescript
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  const { feedback } = args;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_feedback (
      id, timestamp, trace_id, span_id,
      source, feedback_type, value, comment, experiment,
      user_id, organization_id, environment, service_name, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    feedback.id,
    feedback.timestamp.toISOString(),
    feedback.traceId,
    feedback.spanId ?? null,
    feedback.source,
    feedback.feedbackType,
    String(feedback.value),  // Store as string
    feedback.comment ?? null,
    feedback.experiment ?? null,
    feedback.userId ?? null,
    feedback.organizationId ?? null,
    feedback.environment ?? null,
    feedback.serviceName ?? null,
    feedback.metadata ? JSON.stringify(feedback.metadata) : null,
  );
}
```

**Tasks:**
- [ ] Implement createFeedback

### 4.3.6 Implement listFeedback

```typescript
async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_feedback WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.traceId) {
    query += ' AND trace_id = ?';
    params.push(filters.traceId);
  }
  if (filters?.feedbackType) {
    const types = Array.isArray(filters.feedbackType) ? filters.feedbackType : [filters.feedbackType];
    query += ` AND feedback_type IN (${types.map(() => '?').join(', ')})`;
    params.push(...types);
  }
  if (filters?.experiment) {
    query += ' AND experiment = ?';
    params.push(filters.experiment);
  }
  // ... more filters

  query += ` ORDER BY timestamp ${orderBy?.direction ?? 'desc'}`;

  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToFeedbackRecord),
    pagination: { total: this.getFeedbackCount(filters), limit, offset },
  };
}
```

**Tasks:**
- [ ] Implement listFeedback with filters

### 4.3.7 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { /* existing */ },
    logs: { /* existing */ },
    metrics: { /* existing */ },
    scores: { supported: true },
    feedback: { supported: true },
  };
}
```

**Tasks:**
- [ ] Set scores capability
- [ ] Set feedback capability

### PR 4.3 Testing

**Tasks:**
- [ ] Test scores table creation
- [ ] Test createScore inserts correctly
- [ ] Test listScores with various filters
- [ ] Test feedback table creation
- [ ] Test createFeedback inserts correctly
- [ ] Test listFeedback with various filters

---

## PR 4.4: ClickHouse Scores/Feedback Support

**Package:** `stores/clickhouse`
**Scope:** Scores and Feedback tables and methods

### 4.4.1 Scores Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_scores (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  ScoreId String CODEC(ZSTD(1)),

  -- Target
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),

  -- Score data
  ScorerName LowCardinality(String) CODEC(ZSTD(1)),
  Score Float64 CODEC(ZSTD(1)),
  Reason String CODEC(ZSTD(1)),
  Metadata String CODEC(ZSTD(1)),  -- JSON string
  Experiment LowCardinality(String) CODEC(ZSTD(1)),

  -- Multi-tenancy
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  UserId String CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_experiment Experiment TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (ScorerName, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 365 DAY
```

**Notes:**
- 365-day TTL for scores (longer retention for analysis)
- `LowCardinality` for scorer names and experiments

**Tasks:**
- [ ] Add scores table creation to `init()`

### 4.4.2 Feedback Table Schema

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_feedback (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  FeedbackId String CODEC(ZSTD(1)),

  -- Target
  TraceId String CODEC(ZSTD(1)),
  SpanId String CODEC(ZSTD(1)),

  -- Feedback data
  Source LowCardinality(String) CODEC(ZSTD(1)),
  FeedbackType LowCardinality(String) CODEC(ZSTD(1)),
  Value String CODEC(ZSTD(1)),  -- Store as string
  Comment String CODEC(ZSTD(1)),
  Experiment LowCardinality(String) CODEC(ZSTD(1)),

  -- Attribution
  UserId String CODEC(ZSTD(1)),

  -- Multi-tenancy
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),

  -- Environment
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Extra
  Metadata String CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
  INDEX idx_span_id SpanId TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_experiment Experiment TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (FeedbackType, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 365 DAY
```

**Tasks:**
- [ ] Add feedback table creation to `init()`

### 4.4.3 Implement createScore

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async createScore(args: CreateScoreArgs): Promise<void> {
  const { score } = args;

  await this.client.insert({
    table: 'mastra_ai_scores',
    values: [{
      Timestamp: score.timestamp.toISOString(),
      ScoreId: score.id,
      TraceId: score.traceId,
      SpanId: score.spanId ?? '',
      ScorerName: score.scorerName,
      Score: score.score,
      Reason: score.reason ?? '',
      Metadata: score.metadata ? JSON.stringify(score.metadata) : '',
      Experiment: score.experiment ?? '',
      OrganizationId: score.organizationId ?? '',
      UserId: score.userId ?? '',
      Environment: score.environment ?? '',
      ServiceName: score.serviceName ?? '',
    }],
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement createScore

### 4.4.4 Implement listScores

```typescript
async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  const { filters, pagination, orderBy } = args;

  let query = 'SELECT * FROM mastra_ai_scores WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (filters?.traceId) {
    query += ' AND TraceId = {traceId:String}';
    params.traceId = filters.traceId;
  }
  if (filters?.scorerName) {
    const names = Array.isArray(filters.scorerName) ? filters.scorerName : [filters.scorerName];
    query += ' AND ScorerName IN ({scorerNames:Array(String)})';
    params.scorerNames = names;
  }
  if (filters?.experiment) {
    query += ' AND Experiment = {experiment:String}';
    params.experiment = filters.experiment;
  }

  const field = orderBy?.field === 'score' ? 'Score' : 'Timestamp';
  query += ` ORDER BY ${field} ${orderBy?.direction ?? 'DESC'}`;

  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = pagination?.limit ?? 100;
  params.offset = pagination?.offset ?? 0;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseScoreRow[]>();

  return {
    data: rows.map(this.rowToScoreRecord.bind(this)),
    pagination: { total: await this.getScoreCount(filters), limit: params.limit, offset: params.offset },
  };
}
```

**Tasks:**
- [ ] Implement listScores with ClickHouse syntax

### 4.4.5 Implement createFeedback

```typescript
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  const { feedback } = args;

  await this.client.insert({
    table: 'mastra_ai_feedback',
    values: [{
      Timestamp: feedback.timestamp.toISOString(),
      FeedbackId: feedback.id,
      TraceId: feedback.traceId,
      SpanId: feedback.spanId ?? '',
      Source: feedback.source,
      FeedbackType: feedback.feedbackType,
      Value: String(feedback.value),
      Comment: feedback.comment ?? '',
      Experiment: feedback.experiment ?? '',
      UserId: feedback.userId ?? '',
      OrganizationId: feedback.organizationId ?? '',
      Environment: feedback.environment ?? '',
      ServiceName: feedback.serviceName ?? '',
      Metadata: feedback.metadata ? JSON.stringify(feedback.metadata) : '',
    }],
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement createFeedback

### 4.4.6 Implement listFeedback

```typescript
async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  // Similar to listScores with ClickHouse syntax
}
```

**Tasks:**
- [ ] Implement listFeedback with ClickHouse syntax

### 4.4.7 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { /* existing */ },
    logs: { /* existing */ },
    metrics: { /* existing */ },
    scores: { supported: true },
    feedback: { supported: true },
  };
}
```

**Tasks:**
- [ ] Set scores capability
- [ ] Set feedback capability

### PR 4.4 Testing

**Tasks:**
- [ ] Test scores table creation
- [ ] Test createScore inserts correctly
- [ ] Test listScores with various filters
- [ ] Test feedback table creation
- [ ] Test createFeedback inserts correctly
- [ ] Test listFeedback with various filters

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Add score to active span
- [ ] E2E test: Add feedback to active span
- [ ] E2E test: Add score to trace (no span)
- [ ] E2E test: Retrieve trace and add post-hoc score
- [ ] E2E test: Retrieve trace and add post-hoc feedback
- [ ] E2E test: List scores by trace ID
- [ ] E2E test: List feedback by experiment
- [ ] E2E test: Verify metrics extracted from score events

---

## Dependencies Between PRs

```
PR 4.1 (@mastra/core)
    ↓
PR 4.2 (@mastra/observability) ← depends on core types
    ↓
PR 4.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 4.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 4.3 and PR 4.4 can be done in parallel after PR 4.2.

**Merge order:** 4.1 → 4.2 → (4.3 | 4.4)

---

## Definition of Done

- [ ] span.addScore() and span.addFeedback() working
- [ ] trace.addScore() and trace.addFeedback() working
- [ ] mastra.getTrace() returns Trace with spans
- [ ] Post-hoc score/feedback attachment working
- [ ] DefaultExporter writes scores and feedback
- [ ] DuckDB adapter stores and retrieves scores/feedback
- [ ] ClickHouse adapter stores and retrieves scores/feedback
- [ ] All tests pass
- [ ] Documentation updated

---

## Open Questions

1. Should we support batch score/feedback creation?
2. Should scores be linked to the existing evals scores table?
3. What's the migration path from existing `addScoreToTrace` API?
4. Should we add experiment/run grouping for score aggregation?
