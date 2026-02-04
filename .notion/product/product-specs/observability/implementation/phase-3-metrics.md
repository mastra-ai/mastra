# Phase 3: Metrics

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Logging)
**Estimated Scope:** MetricsContext implementation, auto-extracted metrics, storage

---

## Overview

Phase 3 implements the metrics system with both direct API and auto-extracted metrics:
- MetricsContext implementation with auto-labels and cardinality protection
- MetricRecord schema and storage methods
- MetricEvent → exporter routing via ObservabilityBus
- TracingEvent → MetricEvent cross-emission for auto-extracted metrics
- Built-in metrics catalog

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 3.1 | `@mastra/core` | MetricRecord schema, storage interface, cardinality config |
| PR 3.2 | `@mastra/observability` | MetricsContext impl, auto-extraction, ObservabilityBus wiring |
| PR 3.3 | `stores/duckdb` | Metrics table and methods |
| PR 3.4 | `stores/clickhouse` | Metrics table and methods |

---

## PR 3.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** MetricRecord schema, storage interface extensions, cardinality config

### 3.1.1 MetricRecord Schema

**File:** `packages/core/src/observability/types/metrics.ts` (new)

```typescript
import { z } from 'zod';

export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram']);
export type MetricType = z.infer<typeof metricTypeSchema>;

export const metricRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  name: z.string(),
  type: metricTypeSchema,
  value: z.number(),

  // Labels (cardinality-controlled)
  labels: z.record(z.string()),

  // Environment (not in labels to avoid cardinality issues)
  organizationId: z.string().optional(),
  environment: z.string().optional(),
  serviceName: z.string().optional(),

  // Histogram-specific
  bucketBoundaries: z.array(z.number()).optional(),
  bucketCounts: z.array(z.number()).optional(),
});

export type MetricRecord = z.infer<typeof metricRecordSchema>;

export interface MetricInput {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
}
```

**Tasks:**
- [ ] Define metricTypeSchema enum
- [ ] Define metricRecordSchema with cardinality-safe structure
- [ ] Define MetricInput for API
- [ ] Export from types index

### 3.1.2 Cardinality Configuration

**File:** `packages/core/src/observability/types/config.ts` (modify)

```typescript
export interface CardinalityConfig {
  /**
   * Labels to block from metrics.
   * Set to undefined to use DEFAULT_BLOCKED_LABELS.
   * Set to empty array to allow all labels.
   */
  blockedLabels?: string[];

  /**
   * Whether to block UUID-like values in labels.
   * Default: true
   */
  blockUUIDs?: boolean;
}

export const DEFAULT_BLOCKED_LABELS = [
  'trace_id',
  'span_id',
  'run_id',
  'request_id',
  'user_id',
  'resource_id',
  'session_id',
  'thread_id',
];

export interface MetricsConfig {
  cardinality?: CardinalityConfig;
}

// Update ObservabilityConfig
export interface ObservabilityConfig {
  serviceName: string;
  environment?: string;
  exporters: ObservabilityExporter[];
  logLevel?: LogLevel;
  sampling?: SamplingConfig;
  processors?: SignalProcessor[];
  metrics?: MetricsConfig;
}
```

**Tasks:**
- [ ] Define CardinalityConfig interface
- [ ] Define DEFAULT_BLOCKED_LABELS constant
- [ ] Add metrics config to ObservabilityConfig
- [ ] Export from types index

### 3.1.3 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class

// === Metrics ===
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  throw new Error('Not implemented');
}

// Types
export interface BatchRecordMetricsArgs {
  metrics: MetricRecord[];
}

export interface ListMetricsArgs {
  filters?: {
    name?: string | string[];
    type?: MetricType | MetricType[];
    organizationId?: string;
    serviceName?: string;
    environment?: string;
    startTime?: Date;
    endTime?: Date;
    labels?: Record<string, string>;  // exact match on label values
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  orderBy?: {
    field: 'timestamp' | 'name';
    direction: 'asc' | 'desc';
  };
  aggregation?: {
    type: 'sum' | 'avg' | 'min' | 'max' | 'count';
    interval?: '1m' | '5m' | '15m' | '1h' | '1d';
    groupBy?: string[];  // label keys to group by
  };
}
```

**Tasks:**
- [ ] Add `batchRecordMetrics()` method
- [ ] Add `listMetrics()` method with aggregation support
- [ ] Define BatchRecordMetricsArgs interface
- [ ] Define ListMetricsArgs interface with aggregation

### 3.1.4 Verify Storage Strategy Types

**File:** `packages/core/src/storage/domains/observability/types.ts`

```typescript
// Verify MetricsStorageStrategy type exists (added in Phase 1)
export type MetricsStorageStrategy = 'realtime' | 'batch';
```

The `metricsStrategy` getter is already defined in Phase 1 (returns `null` by default). Subclasses override to declare support.

**Tasks:**
- [ ] Verify MetricsStorageStrategy type exists

### PR 3.1 Testing

**Tasks:**
- [ ] Test MetricRecord schema validation
- [ ] Test cardinality config defaults
- [ ] Verify type exports

---

## PR 3.2: @mastra/observability Changes

**Package:** `observability/mastra`
**Scope:** MetricsContext implementation, auto-extraction, ObservabilityBus wiring

### 3.2.1 Cardinality Filter

**File:** `observability/mastra/src/metrics/cardinality.ts` (new)

```typescript
import { CardinalityConfig, DEFAULT_BLOCKED_LABELS } from '@mastra/core';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CardinalityFilter {
  private blockedLabels: Set<string>;
  private blockUUIDs: boolean;

  constructor(config?: CardinalityConfig) {
    const blocked = config?.blockedLabels ?? DEFAULT_BLOCKED_LABELS;
    this.blockedLabels = new Set(blocked.map(l => l.toLowerCase()));
    this.blockUUIDs = config?.blockUUIDs ?? true;
  }

  filterLabels(labels: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};

    for (const [key, value] of Object.entries(labels)) {
      // Skip blocked label names
      if (this.blockedLabels.has(key.toLowerCase())) {
        continue;
      }

      // Skip UUID values if blockUUIDs is enabled
      if (this.blockUUIDs && UUID_REGEX.test(value)) {
        continue;
      }

      filtered[key] = value;
    }

    return filtered;
  }
}
```

**Tasks:**
- [ ] Implement CardinalityFilter class
- [ ] Support blocked labels list
- [ ] Support UUID detection and blocking
- [ ] Make case-insensitive for label names

### 3.2.2 MetricsContext Implementation

**File:** `observability/mastra/src/context/metrics.ts` (new)

```typescript
import { MetricsContext, Counter, Gauge, Histogram, MetricEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';
import { CardinalityFilter } from '../metrics/cardinality';
import { generateId } from '../utils/id';

export interface MetricsContextConfig {
  // Base labels (auto-injected)
  baseLabels: Record<string, string>;

  // Bus for emission
  observabilityBus: ObservabilityBus;

  // Cardinality filter
  cardinalityFilter: CardinalityFilter;

  // Environment
  organizationId?: string;
  environment?: string;
  serviceName?: string;
}

export class MetricsContextImpl implements MetricsContext {
  private config: MetricsContextConfig;

  constructor(config: MetricsContextConfig) {
    this.config = config;
  }

  counter(name: string): Counter {
    return {
      add: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'counter', value, additionalLabels);
      },
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'gauge', value, additionalLabels);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      record: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'histogram', value, additionalLabels);
      },
    };
  }

  private emit(
    name: string,
    type: 'counter' | 'gauge' | 'histogram',
    value: number,
    additionalLabels?: Record<string, string>,
  ): void {
    // Merge labels and apply cardinality filter
    const allLabels = {
      ...this.config.baseLabels,
      ...additionalLabels,
    };
    const filteredLabels = this.config.cardinalityFilter.filterLabels(allLabels);

    const event: MetricEvent = {
      type: 'metric',
      name,
      metricType: type,
      value,
      labels: filteredLabels,
      timestamp: new Date(),
    };

    this.config.observabilityBus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement MetricsContextImpl class
- [ ] Auto-inject base labels
- [ ] Apply cardinality filter to all labels
- [ ] Emit MetricEvent to ObservabilityBus

### 3.2.3 NoOp MetricsContext Update

**File:** `packages/core/src/observability/no-op/context.ts` (modify)

Ensure the NoOp implementation is already in place from Phase 1.

**Tasks:**
- [ ] Verify NoOp MetricsContext works correctly

### 3.2.4 Auto-Extracted Metrics

**File:** `observability/mastra/src/metrics/auto-extract.ts` (new)

```typescript
import { TracingEvent, MetricEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class AutoExtractedMetrics {
  constructor(private observabilityBus: ObservabilityBus) {}

  /**
   * Extract metrics from tracing events
   */
  processTracingEvent(event: TracingEvent): void {
    switch (event.type) {
      case 'span.started':
        this.onSpanStarted(event.exportedSpan);
        break;
      case 'span.ended':
        this.onSpanEnded(event.exportedSpan);
        break;
      case 'score.added':
        this.onScoreAdded(event);
        break;
      case 'feedback.added':
        this.onFeedbackAdded(event);
        break;
    }
  }

  private onSpanStarted(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);

    // Emit started counter based on entity type
    const metricName = this.getStartedMetricName(span);
    if (metricName) {
      this.emit(metricName, 'counter', 1, labels);
    }
  }

  private onSpanEnded(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);
    labels.status = span.status ?? 'unknown';

    // Emit ended counter
    const endedMetricName = this.getEndedMetricName(span);
    if (endedMetricName) {
      this.emit(endedMetricName, 'counter', 1, labels);
    }

    // Emit duration histogram
    const durationMetricName = this.getDurationMetricName(span);
    if (durationMetricName && span.startedAt && span.endedAt) {
      const durationMs = span.endedAt.getTime() - span.startedAt.getTime();
      this.emit(durationMetricName, 'histogram', durationMs, labels);
    }

    // Extract token metrics for LLM spans
    if (span.type === 'llm') {
      this.extractTokenMetrics(span, labels);
    }
  }

  private onScoreAdded(event: { score: ScoreInput }): void {
    const labels = {
      scorer: event.score.scorerName,
      // experiment: event.score.experiment,  // TODO: add when available
    };
    this.emit('mastra_scores_total', 'counter', 1, labels);
  }

  private onFeedbackAdded(event: { feedback: FeedbackInput }): void {
    const labels = {
      feedback_type: event.feedback.feedbackType,
      source: event.feedback.source,
      // experiment: event.feedback.experiment,  // TODO: add when available
    };
    this.emit('mastra_feedback_total', 'counter', 1, labels);
  }

  private extractLabels(span: AnyExportedSpan): Record<string, string> {
    const labels: Record<string, string> = {};

    if (span.entityType) labels.entity_type = span.entityType;
    if (span.entityName) labels.entity_name = span.entityName;
    if (span.environment) labels.env = span.environment;
    if (span.serviceName) labels.service = span.serviceName;

    // Type-specific labels
    if (span.type === 'agent') {
      labels.agent = span.entityName ?? 'unknown';
    } else if (span.type === 'tool') {
      labels.tool = span.entityName ?? 'unknown';
    } else if (span.type === 'workflow') {
      labels.workflow = span.entityName ?? 'unknown';
    } else if (span.type === 'llm') {
      // Extract model info from attributes
      if (span.attributes?.model) labels.model = String(span.attributes.model);
      if (span.attributes?.provider) labels.provider = String(span.attributes.provider);
    }

    return labels;
  }

  private extractTokenMetrics(span: AnyExportedSpan, labels: Record<string, string>): void {
    const attrs = span.attributes ?? {};

    if (attrs.inputTokens !== undefined) {
      this.emit('mastra_model_input_tokens', 'counter', Number(attrs.inputTokens), {
        ...labels,
        token_type: 'input',
      });
    }

    if (attrs.outputTokens !== undefined) {
      this.emit('mastra_model_output_tokens', 'counter', Number(attrs.outputTokens), {
        ...labels,
        token_type: 'output',
      });
    }

    // Cache tokens if available
    if (attrs.cacheReadTokens !== undefined) {
      this.emit('mastra_model_input_tokens', 'counter', Number(attrs.cacheReadTokens), {
        ...labels,
        token_type: 'cache_read',
      });
    }

    if (attrs.cacheWriteTokens !== undefined) {
      this.emit('mastra_model_input_tokens', 'counter', Number(attrs.cacheWriteTokens), {
        ...labels,
        token_type: 'cache_write',
      });
    }
  }

  private getStartedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent': return 'mastra_agent_runs_started';
      case 'tool': return 'mastra_tool_calls_started';
      case 'workflow': return 'mastra_workflow_runs_started';
      case 'llm': return 'mastra_model_requests_started';
      default: return null;
    }
  }

  private getEndedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent': return 'mastra_agent_runs_ended';
      case 'tool': return 'mastra_tool_calls_ended';
      case 'workflow': return 'mastra_workflow_runs_ended';
      case 'llm': return 'mastra_model_requests_ended';
      default: return null;
    }
  }

  private getDurationMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent': return 'mastra_agent_duration_ms';
      case 'tool': return 'mastra_tool_duration_ms';
      case 'workflow': return 'mastra_workflow_duration_ms';
      case 'llm': return 'mastra_model_duration_ms';
      default: return null;
    }
  }

  private emit(
    name: string,
    type: 'counter' | 'gauge' | 'histogram',
    value: number,
    labels: Record<string, string>,
  ): void {
    this.metricsBus.emit({
      type: 'metric',
      name,
      metricType: type,
      value,
      labels,
      timestamp: new Date(),
    });
  }
}
```

**Tasks:**
- [ ] Implement AutoExtractedMetrics class
- [ ] Extract agent/tool/workflow/model metrics from spans
- [ ] Extract token usage metrics from LLM spans
- [ ] Extract score/feedback metrics
- [ ] Add experiment label placeholder for scores/feedback

### 3.2.5 Update ObservabilityBus for Auto-Extracted Metrics

**File:** `observability/mastra/src/bus/observability.ts` (modify)

The ObservabilityBus (created in Phase 1) is extended to support auto-extracted metrics. When TracingEvents are processed, the bus can emit corresponding MetricEvents.

```typescript
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private autoExtractor?: AutoExtractedMetrics;

  enableAutoExtractedMetrics(): void {
    this.autoExtractor = new AutoExtractedMetrics(this);
  }

  emit(event: ObservabilityEvent): void {
    // Route to exporters
    for (const exporter of this.exporters) {
      this.routeToHandler(exporter, event);
    }

    // Cross-emit: TracingEvents → MetricEvents
    if (this.autoExtractor && isTracingEvent(event)) {
      this.autoExtractor.processTracingEvent(event);
    }
  }

  // ... existing routeToHandler implementation from Phase 1
}

function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return event.type.startsWith('span.');
}
```

**Tasks:**
- [ ] Add enableAutoExtractedMetrics() to ObservabilityBus
- [ ] Add cross-emission in emit() for TracingEvent → MetricEvent
- [ ] Add isTracingEvent type guard helper

### 3.2.6 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
// In constructor or init
private cardinalityFilter: CardinalityFilter;

constructor(config: ObservabilityConfig) {
  // ... existing setup

  // Initialize cardinality filter
  this.cardinalityFilter = new CardinalityFilter(config.metrics?.cardinality);

  // Enable auto-extracted metrics if metrics are supported
  if (config.metrics?.enabled !== false) {
    this.observabilityBus.enableAutoExtractedMetrics();
  }
}

// Add createMetricsContext method
createMetricsContext(
  entityContext?: { entityType?: string; entityName?: string }
): MetricsContext {
  // Return no-op if metrics not enabled
  if (!this.config.metrics?.enabled) {
    return noOpMetricsContext;
  }

  const baseLabels: Record<string, string> = {};
  if (entityContext?.entityType) baseLabels.entity_type = entityContext.entityType;
  if (entityContext?.entityName) baseLabels.entity_name = entityContext.entityName;
  if (this.config.environment) baseLabels.env = this.config.environment;
  if (this.config.serviceName) baseLabels.service = this.config.serviceName;

  return new MetricsContextImpl({
    baseLabels,
    observabilityBus: this.observabilityBus,
    cardinalityFilter: this.cardinalityFilter,
    organizationId: this.config.organizationId,
    environment: this.config.environment,
    serviceName: this.config.serviceName,
  });
}
```

**Tasks:**
- [ ] Initialize CardinalityFilter
- [ ] Enable auto-extracted metrics on ObservabilityBus
- [ ] Add createMetricsContext method using ObservabilityBus

### 3.2.8 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
export class DefaultExporter extends BaseExporter {
  // Handler presence = signal support

  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (!this.storage) return;

    const record: MetricRecord = {
      id: generateId(),
      timestamp: event.timestamp,
      name: event.name,
      type: event.metricType,
      value: event.value,
      labels: event.labels,
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    };

    await this.storage.batchRecordMetrics({ metrics: [record] });
  }
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler
- [ ] Consider batching multiple metrics

### 3.2.9 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  this.output('metric', {
    name: event.name,
    type: event.metricType,
    value: event.value,
    labels: event.labels,
    timestamp: event.timestamp.toISOString(),
  });
}
```

**Tasks:**
- [ ] Implement `onMetricEvent`

### 3.2.10 Update GrafanaCloudExporter

**File:** `observability/grafana-cloud/src/exporter.ts` (from Phase 1.5)

**Tasks:**
- [ ] Implement `onMetricEvent` for Mimir push
- [ ] Use Prometheus remote write format

### PR 3.2 Testing

**Tasks:**
- [ ] Test MetricsContextImpl emits to bus
- [ ] Test cardinality filter blocks high-cardinality labels
- [ ] Test cardinality filter blocks UUIDs
- [ ] Test auto-extracted metrics from span events
- [ ] Test token metrics extraction
- [ ] Test DefaultExporter writes metrics
- [ ] Test JsonExporter outputs metrics

---

## PR 3.3: DuckDB Metrics Support

**Package:** `stores/duckdb`
**Scope:** Metrics table and storage methods

### 3.3.1 Metrics Table Schema

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_metrics (
  id VARCHAR PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  value DOUBLE NOT NULL,

  -- Labels stored as JSON (for flexibility)
  labels JSON,

  -- Environment
  organization_id VARCHAR,
  environment VARCHAR,
  service_name VARCHAR,

  -- Histogram support
  bucket_boundaries DOUBLE[],
  bucket_counts BIGINT[]
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON mastra_ai_metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON mastra_ai_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON mastra_ai_metrics(name, timestamp DESC);
```

**Tasks:**
- [ ] Add metrics table creation to `init()`
- [ ] Create indexes for time-series queries

### 3.3.2 Implement batchRecordMetrics

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  const { metrics } = args;
  if (metrics.length === 0) return;

  const stmt = this.db.prepare(`
    INSERT INTO mastra_ai_metrics (
      id, timestamp, name, type, value, labels,
      organization_id, environment, service_name,
      bucket_boundaries, bucket_counts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const metric of metrics) {
    stmt.run(
      metric.id,
      metric.timestamp.toISOString(),
      metric.name,
      metric.type,
      metric.value,
      JSON.stringify(metric.labels),
      metric.organizationId ?? null,
      metric.environment ?? null,
      metric.serviceName ?? null,
      metric.bucketBoundaries ? JSON.stringify(metric.bucketBoundaries) : null,
      metric.bucketCounts ? JSON.stringify(metric.bucketCounts) : null,
    );
  }
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Handle labels JSON serialization

### 3.3.3 Implement listMetrics

**File:** `stores/duckdb/src/storage/domains/observability/index.ts` (modify)

```typescript
async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, pagination, orderBy, aggregation } = args;

  // Build query based on whether aggregation is requested
  if (aggregation) {
    return this.listMetricsAggregated(args);
  }

  let query = 'SELECT * FROM mastra_ai_metrics WHERE 1=1';
  const params: unknown[] = [];

  // Apply filters
  if (filters?.name) {
    const names = Array.isArray(filters.name) ? filters.name : [filters.name];
    query += ` AND name IN (${names.map(() => '?').join(', ')})`;
    params.push(...names);
  }
  if (filters?.startTime) {
    query += ' AND timestamp >= ?';
    params.push(filters.startTime.toISOString());
  }
  if (filters?.endTime) {
    query += ' AND timestamp <= ?';
    params.push(filters.endTime.toISOString());
  }
  if (filters?.labels) {
    // DuckDB JSON filtering
    for (const [key, value] of Object.entries(filters.labels)) {
      query += ` AND json_extract_string(labels, '$.${key}') = ?`;
      params.push(value);
    }
  }

  // Order and pagination
  const order = orderBy?.direction ?? 'desc';
  query += ` ORDER BY ${orderBy?.field ?? 'timestamp'} ${order}`;
  const limit = pagination?.limit ?? 100;
  const offset = pagination?.offset ?? 0;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = this.db.prepare(query).all(...params);

  return {
    data: rows.map(this.rowToMetricRecord),
    pagination: { total: this.getMetricCount(filters), limit, offset },
  };
}

private listMetricsAggregated(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, aggregation } = args;

  // Build aggregation query
  let selectCols = [`${aggregation!.type}(value) as value`];
  let groupBy: string[] = ['name'];

  if (aggregation!.interval) {
    selectCols.push(`time_bucket(INTERVAL '${aggregation!.interval}', timestamp) as timestamp`);
    groupBy.push('timestamp');
  }

  if (aggregation!.groupBy) {
    for (const label of aggregation!.groupBy) {
      selectCols.push(`json_extract_string(labels, '$.${label}') as label_${label}`);
      groupBy.push(`label_${label}`);
    }
  }

  let query = `SELECT name, ${selectCols.join(', ')} FROM mastra_ai_metrics WHERE 1=1`;
  // ... add filters ...
  query += ` GROUP BY ${groupBy.join(', ')}`;

  // Execute and return
  // ...
}
```

**Tasks:**
- [ ] Implement listMetrics with filters
- [ ] Support label filtering via JSON extraction
- [ ] Implement aggregation queries
- [ ] Use DuckDB time_bucket for time-series grouping

### 3.3.4 Update Capabilities

```typescript
// Add metrics strategy getter
get metricsStrategy(): { preferred: MetricsStorageStrategy; supported: MetricsStorageStrategy[] } {
  return { preferred: 'batch', supported: ['realtime', 'batch'] };
}
```

**Tasks:**
- [ ] Add `metricsStrategy` getter to declare metrics support

### PR 3.3 Testing

**Tasks:**
- [ ] Test metrics table creation
- [ ] Test batchRecordMetrics inserts correctly
- [ ] Test listMetrics with various filters
- [ ] Test label filtering
- [ ] Test aggregation queries
- [ ] Test time-series grouping

---

## PR 3.4: ClickHouse Metrics Support

**Package:** `stores/clickhouse`
**Scope:** Metrics table and storage methods

### 3.4.1 Metrics Table Schema

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```sql
CREATE TABLE IF NOT EXISTS mastra_ai_metrics (
  Timestamp DateTime64(9) CODEC(Delta(8), ZSTD(1)),
  MetricId String CODEC(ZSTD(1)),
  Name LowCardinality(String) CODEC(ZSTD(1)),
  Type LowCardinality(String) CODEC(ZSTD(1)),
  Value Float64 CODEC(ZSTD(1)),

  -- Labels as Map for efficient storage and querying
  Labels Map(LowCardinality(String), String) CODEC(ZSTD(1)),

  -- Environment
  OrganizationId LowCardinality(String) CODEC(ZSTD(1)),
  Environment LowCardinality(String) CODEC(ZSTD(1)),
  ServiceName LowCardinality(String) CODEC(ZSTD(1)),

  -- Indexes
  INDEX idx_labels_key mapKeys(Labels) TYPE bloom_filter(0.01) GRANULARITY 1,
  INDEX idx_labels_value mapValues(Labels) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (Name, toUnixTimestamp(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 90 DAY
```

**Notes:**
- `Map(LowCardinality(String), String)` for Labels enables efficient label filtering
- `bloom_filter` indexes on mapKeys/mapValues enable filtering on specific labels
- 90-day TTL default (metrics typically need longer retention than logs)

**Tasks:**
- [ ] Add metrics table creation to `init()`
- [ ] Use ClickHouse-optimized types
- [ ] Add bloom filter indexes for label queries

### 3.4.2 Implement batchRecordMetrics

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
  const { metrics } = args;
  if (metrics.length === 0) return;

  const rows = metrics.map(metric => ({
    Timestamp: metric.timestamp.toISOString(),
    MetricId: metric.id,
    Name: metric.name,
    Type: metric.type,
    Value: metric.value,
    Labels: metric.labels,
    OrganizationId: metric.organizationId ?? '',
    Environment: metric.environment ?? '',
    ServiceName: metric.serviceName ?? '',
  }));

  await this.client.insert({
    table: 'mastra_ai_metrics',
    values: rows,
    format: 'JSONEachRow',
  });
}
```

**Tasks:**
- [ ] Implement batch insert
- [ ] Use Map type for labels

### 3.4.3 Implement listMetrics

**File:** `stores/clickhouse/src/storage/domains/observability/index.ts` (modify)

```typescript
async listMetrics(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, pagination, orderBy, aggregation } = args;

  if (aggregation) {
    return this.listMetricsAggregated(args);
  }

  let query = 'SELECT * FROM mastra_ai_metrics WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (filters?.name) {
    const names = Array.isArray(filters.name) ? filters.name : [filters.name];
    query += ' AND Name IN ({names:Array(String)})';
    params.names = names;
  }
  if (filters?.startTime) {
    query += ' AND Timestamp >= {startTime:DateTime64(9)}';
    params.startTime = filters.startTime.toISOString();
  }
  if (filters?.labels) {
    // ClickHouse Map filtering
    for (const [key, value] of Object.entries(filters.labels)) {
      query += ` AND Labels[{labelKey_${key}:String}] = {labelValue_${key}:String}`;
      params[`labelKey_${key}`] = key;
      params[`labelValue_${key}`] = value;
    }
  }

  // Order and pagination
  query += ` ORDER BY Timestamp ${orderBy?.direction ?? 'DESC'}`;
  query += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
  params.limit = pagination?.limit ?? 100;
  params.offset = pagination?.offset ?? 0;

  const result = await this.client.query({
    query,
    query_params: params,
    format: 'JSONEachRow',
  });

  const rows = await result.json<ClickHouseMetricRow[]>();

  return {
    data: rows.map(this.rowToMetricRecord.bind(this)),
    pagination: { total: await this.getMetricCount(filters), limit: params.limit, offset: params.offset },
  };
}

private async listMetricsAggregated(args: ListMetricsArgs): Promise<PaginatedResult<MetricRecord>> {
  const { filters, aggregation } = args;

  // ClickHouse aggregation with time bucketing
  let selectCols = [`${aggregation!.type}(Value) as Value`];
  let groupBy = ['Name'];

  if (aggregation!.interval) {
    const intervalSeconds = this.intervalToSeconds(aggregation!.interval);
    selectCols.push(`toStartOfInterval(Timestamp, INTERVAL ${intervalSeconds} second) as Timestamp`);
    groupBy.push('Timestamp');
  }

  if (aggregation!.groupBy) {
    for (const label of aggregation!.groupBy) {
      selectCols.push(`Labels[{groupLabel_${label}:String}] as label_${label}`);
      groupBy.push(`label_${label}`);
    }
  }

  let query = `SELECT Name, ${selectCols.join(', ')} FROM mastra_ai_metrics WHERE 1=1`;
  // ... add filters ...
  query += ` GROUP BY ${groupBy.join(', ')}`;
  query += ` ORDER BY Timestamp`;

  // Execute and return
}

private intervalToSeconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400,
  };
  return map[interval] ?? 60;
}
```

**Tasks:**
- [ ] Implement listMetrics with ClickHouse syntax
- [ ] Support Map-based label filtering
- [ ] Implement aggregation with toStartOfInterval
- [ ] Support groupBy labels

### 3.4.4 Update Capabilities

```typescript
get capabilities(): StorageCapabilities {
  return {
    tracing: { /* existing */ },
    logs: { /* existing */ },
    metrics: {
      preferred: 'insert-only',
      supported: ['insert-only'],
      supportsAggregation: true,
    },
    scores: { supported: false },
    feedback: { supported: false },
  };
}
```

**Tasks:**
- [ ] Set metrics capability
- [ ] Enable aggregation support

### PR 3.4 Testing

**Tasks:**
- [ ] Test metrics table creation
- [ ] Test batchRecordMetrics inserts correctly
- [ ] Test listMetrics with various filters
- [ ] Test Map-based label filtering
- [ ] Test aggregation queries
- [ ] Test time-series grouping

---

## Built-in Metrics Catalog

Reference table for auto-extracted metrics:

### Agent Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_agent_runs_started` | counter | agent, env, service |
| `mastra_agent_runs_ended` | counter | agent, status, env, service |
| `mastra_agent_duration_ms` | histogram | agent, status, env, service |

### Model Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_model_requests_started` | counter | model, provider, agent |
| `mastra_model_requests_ended` | counter | model, provider, agent, status |
| `mastra_model_duration_ms` | histogram | model, provider, agent |
| `mastra_model_input_tokens` | counter | model, provider, agent, token_type |
| `mastra_model_output_tokens` | counter | model, provider, agent, token_type |

### Tool Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_tool_calls_started` | counter | tool, agent, env |
| `mastra_tool_calls_ended` | counter | tool, agent, status, env |
| `mastra_tool_duration_ms` | histogram | tool, agent, env |

### Workflow Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_workflow_runs_started` | counter | workflow, env |
| `mastra_workflow_runs_ended` | counter | workflow, status, env |
| `mastra_workflow_duration_ms` | histogram | workflow, status, env |

### Score/Feedback Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_scores_total` | counter | scorer, entity_type, entity_name, experiment |
| `mastra_feedback_total` | counter | feedback_type, source, experiment |

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Auto-extracted metrics appear when agent runs
- [ ] E2E test: Token usage metrics extracted from LLM calls
- [ ] E2E test: Direct metrics API works from tool context
- [ ] E2E test: Cardinality filter blocks high-cardinality labels
- [ ] E2E test: Metrics appear in storage and exporters
- [ ] E2E test: Aggregation queries return correct results

---

## Dependencies Between PRs

```
PR 3.1 (@mastra/core)
    ↓
PR 3.2 (@mastra/observability) ← depends on core types
    ↓
PR 3.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 3.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 3.3 and PR 3.4 can be done in parallel after PR 3.2.

**Merge order:** 3.1 → 3.2 → (3.3 | 3.4)

---

## Definition of Done

- [ ] MetricsContext implementation complete
- [ ] Auto-extracted metrics flowing from span events
- [ ] Cardinality protection working
- [ ] DefaultExporter writes metrics to storage
- [ ] JsonExporter outputs metrics
- [ ] DuckDB adapter stores and retrieves metrics with aggregation
- [ ] ClickHouse adapter stores and retrieves metrics with aggregation
- [ ] All tests pass
- [ ] Documentation updated with metrics catalog

---

## Open Questions

1. Should histogram buckets be configurable per-metric or global?
2. What should the default histogram boundaries be?
3. Should we add pre-aggregation for common time-series queries?
4. Do we need a separate metrics registry for discovery?
