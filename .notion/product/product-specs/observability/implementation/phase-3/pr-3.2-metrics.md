# PR 3.2: Metrics Context Implementation

**Package:** `observability/mastra`
**Scope:** MetricsContext implementation, cardinality filter, mastra.metrics direct API

**Note:** Auto-extracted metrics from TracingEvents are in PR 3.3 (separate PR for cleaner review).

---

## 3.2.1 Cardinality Filter

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
      if (this.blockedLabels.has(key.toLowerCase())) {
        continue;
      }

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

---

## 3.2.2 MetricsContext Implementation

**File:** `observability/mastra/src/context/metrics.ts` (new)

```typescript
import type { MetricsContext, Counter, Gauge, Histogram, ExportedMetric, MetricEvent, MetricType } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';
import { CardinalityFilter } from '../metrics/cardinality';

export interface MetricsContextConfig {
  baseLabels: Record<string, string>;
  observabilityBus: ObservabilityBus;
  cardinalityFilter: CardinalityFilter;
  context?: Record<string, unknown>;
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
    metricType: MetricType,
    value: number,
    additionalLabels?: Record<string, string>,
  ): void {
    const allLabels = {
      ...this.config.baseLabels,
      ...additionalLabels,
    };
    const filteredLabels = this.config.cardinalityFilter.filterLabels(allLabels);

    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      metricType,
      value,
      labels: filteredLabels,
      metadata: this.config.context,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.config.observabilityBus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement MetricsContextImpl class
- [ ] Auto-inject base labels
- [ ] Apply cardinality filter to all labels
- [ ] Environment fields go in metadata (not labels)
- [ ] Emit MetricEvent to ObservabilityBus

---

## 3.2.3 Direct Metrics API (mastra.metrics)

**File:** `observability/mastra/src/instances/base.ts` (modify)

Add `mastra.metrics` direct API for use outside trace context:

```typescript
// In BaseObservabilityInstance or DefaultObservabilityInstance
createDirectMetricsContext(): MetricsContext {
  if (!this.observabilityBus) {
    return noOpMetricsContext;
  }

  // No baseLabels or entity context - direct API
  return new MetricsContextImpl({
    baseLabels: {},
    observabilityBus: this.observabilityBus,
    cardinalityFilter: this.cardinalityFilter,
    context: {
      organizationId: this.config.organizationId,
      environment: this.config.environment,
      serviceName: this.config.serviceName,
    },
  });
}
```

**Tasks:**
- [ ] Add createDirectMetricsContext() method
- [ ] Wire to mastra.metrics property

---

## 3.2.5 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
private cardinalityFilter: CardinalityFilter;

constructor(config: ObservabilityConfig) {
  // ... existing setup
  this.cardinalityFilter = new CardinalityFilter(config.metrics?.cardinality);
  // Note: Auto-extracted metrics enabled in PR 3.2b
}

createMetricsContext(
  entityContext?: { entityType?: string; entityName?: string }
): MetricsContext {
  if (!this.config.metrics?.enabled) {
    return noOpMetricsContext;
  }

  const baseLabels: Record<string, string> = {};
  if (entityContext?.entityType) baseLabels.entity_type = entityContext.entityType;
  if (entityContext?.entityName) baseLabels.entity_name = entityContext.entityName;

  const context: Record<string, unknown> = {};
  if (this.config.organizationId) context.organizationId = this.config.organizationId;
  if (this.config.environment) context.environment = this.config.environment;
  if (this.config.serviceName) context.serviceName = this.config.serviceName;

  return new MetricsContextImpl({
    baseLabels,
    observabilityBus: this.observabilityBus,
    cardinalityFilter: this.cardinalityFilter,
    context,
  });
}
```

**Tasks:**
- [ ] Initialize CardinalityFilter
- [ ] Add createMetricsContext method
- [ ] Add createDirectMetricsContext method (for mastra.metrics)

---

## 3.2.6 Update DefaultExporter

**File:** `observability/mastra/src/exporters/default.ts` (modify)

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  if (!this.storage) return;

  const record: MetricRecord = {
    id: generateId(),
    timestamp: event.metric.timestamp,
    name: event.metric.name,
    metricType: event.metric.metricType,
    value: event.metric.value,
    labels: event.metric.labels,
    metadata: event.metric.metadata,
  };

  await this.storage.batchRecordMetrics({ metrics: [record] });
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler
- [ ] Convert ExportedMetric → MetricRecord

---

## 3.2.7 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  this.output('metric', event.metric);
}
```

**Tasks:**
- [ ] Implement `onMetricEvent`

---

## 3.2.8 Update GrafanaCloudExporter

**File:** `observability/grafana-cloud/src/exporter.ts`

**Tasks:**
- [ ] Implement `onMetricEvent` for Mimir push
- [ ] Use Prometheus remote write format

---

## PR 3.2 Testing

**Tasks:**
- [ ] Test MetricsContextImpl emits to bus
- [ ] Test cardinality filter blocks high-cardinality labels
- [ ] Test cardinality filter blocks UUIDs
- [ ] Test environment fields go in metadata (not labels)
- [ ] Test mastra.metrics direct API works without trace context
- [ ] Test DefaultExporter writes metrics
- [ ] Test JsonExporter outputs metrics

**Note:** Auto-extracted metrics tests are in PR 3.3.
