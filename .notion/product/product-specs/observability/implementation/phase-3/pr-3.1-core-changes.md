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

