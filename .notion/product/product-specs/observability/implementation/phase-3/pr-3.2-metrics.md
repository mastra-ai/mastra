# PR 3.2: Metrics Implementation

**Package:** `observability/mastra`
**Scope:** MetricsContext implementation, cardinality filter, auto-extracted metrics

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

## 3.2.3 Auto-Extracted Metrics

**File:** `observability/mastra/src/metrics/auto-extract.ts` (new)

```typescript
import type { TracingEvent, ExportedMetric, MetricEvent, AnyExportedSpan, ScoreEvent, FeedbackEvent } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class AutoExtractedMetrics {
  constructor(private observabilityBus: ObservabilityBus) {}

  processTracingEvent(event: TracingEvent): void {
    switch (event.type) {
      case 'span_started':
        this.onSpanStarted(event.exportedSpan);
        break;
      case 'span_ended':
        this.onSpanEnded(event.exportedSpan);
        break;
    }
  }

  processScoreEvent(event: ScoreEvent): void {
    const labels: Record<string, string> = {
      scorer: event.score.scorerName,
    };
    if (event.score.experiment) {
      labels.experiment = event.score.experiment;
    }
    this.emit('mastra_scores_total', 'counter', 1, labels);
  }

  processFeedbackEvent(event: FeedbackEvent): void {
    const labels: Record<string, string> = {
      feedback_type: event.feedback.feedbackType,
      source: event.feedback.source,
    };
    if (event.feedback.experiment) {
      labels.experiment = event.feedback.experiment;
    }
    this.emit('mastra_feedback_total', 'counter', 1, labels);
  }

  private onSpanStarted(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);
    const metricName = this.getStartedMetricName(span);
    if (metricName) {
      this.emit(metricName, 'counter', 1, labels);
    }
  }

  private onSpanEnded(span: AnyExportedSpan): void {
    const labels = this.extractLabels(span);

    const endedMetricName = this.getEndedMetricName(span);
    if (endedMetricName) {
      this.emit(endedMetricName, 'counter', 1, labels);
    }

    const durationMetricName = this.getDurationMetricName(span);
    if (durationMetricName && span.startTime && span.endTime) {
      const durationMs = span.endTime.getTime() - span.startTime.getTime();
      this.emit(durationMetricName, 'histogram', durationMs, labels);
    }

    if (span.type === 'model_generation') {
      this.extractTokenMetrics(span, labels);
    }
  }

  private extractLabels(span: AnyExportedSpan): Record<string, string> {
    const labels: Record<string, string> = {};
    if (span.entityType) labels.entity_type = span.entityType;
    if (span.entityName) labels.entity_name = span.entityName;

    switch (span.type) {
      case 'agent_run':
        labels.agent = span.entityName ?? 'unknown';
        break;
      case 'tool_call':
        labels.tool = span.entityName ?? 'unknown';
        break;
      case 'workflow_run':
        labels.workflow = span.entityName ?? 'unknown';
        break;
      case 'model_generation':
        if (span.attributes?.model) labels.model = String(span.attributes.model);
        if (span.attributes?.provider) labels.provider = String(span.attributes.provider);
        break;
    }
    return labels;
  }

  private extractTokenMetrics(span: AnyExportedSpan, labels: Record<string, string>): void {
    const usage = span.attributes?.usage;
    if (!usage) return;

    if (usage.inputTokens !== undefined) {
      this.emit('mastra_model_input_tokens', 'counter', Number(usage.inputTokens), labels);
    }
    if (usage.outputTokens !== undefined) {
      this.emit('mastra_model_output_tokens', 'counter', Number(usage.outputTokens), labels);
    }
    if (usage.inputDetails?.cacheRead !== undefined) {
      this.emit('mastra_model_cache_read_tokens', 'counter', Number(usage.inputDetails.cacheRead), labels);
    }
    if (usage.inputDetails?.cacheWrite !== undefined) {
      this.emit('mastra_model_cache_write_tokens', 'counter', Number(usage.inputDetails.cacheWrite), labels);
    }
  }

  private getStartedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent_run': return 'mastra_agent_runs_started';
      case 'tool_call': return 'mastra_tool_calls_started';
      case 'workflow_run': return 'mastra_workflow_runs_started';
      case 'model_generation': return 'mastra_model_requests_started';
      default: return null;
    }
  }

  private getEndedMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent_run': return 'mastra_agent_runs_ended';
      case 'tool_call': return 'mastra_tool_calls_ended';
      case 'workflow_run': return 'mastra_workflow_runs_ended';
      case 'model_generation': return 'mastra_model_requests_ended';
      default: return null;
    }
  }

  private getDurationMetricName(span: AnyExportedSpan): string | null {
    switch (span.type) {
      case 'agent_run': return 'mastra_agent_duration_ms';
      case 'tool_call': return 'mastra_tool_duration_ms';
      case 'workflow_run': return 'mastra_workflow_duration_ms';
      case 'model_generation': return 'mastra_model_duration_ms';
      default: return null;
    }
  }

  private emit(
    name: string,
    metricType: 'counter' | 'gauge' | 'histogram',
    value: number,
    labels: Record<string, string>,
  ): void {
    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      metricType,
      value,
      labels,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.observabilityBus.emit(event);
  }
}
```

**Tasks:**
- [ ] Implement AutoExtractedMetrics class
- [ ] Extract agent/tool/workflow/model metrics from spans
- [ ] Extract token usage metrics from LLM spans
- [ ] Extract score/feedback metrics

---

## 3.2.4 Update ObservabilityBus for Auto-Extraction

**File:** `observability/mastra/src/bus/observability.ts` (modify)

```typescript
export class ObservabilityBus extends BaseObservabilityEventBus<ObservabilityEvent> {
  private exporters: ObservabilityExporter[] = [];
  private autoExtractor?: AutoExtractedMetrics;

  enableAutoExtractedMetrics(): void {
    this.autoExtractor = new AutoExtractedMetrics(this);
  }

  emit(event: ObservabilityEvent): void {
    for (const exporter of this.exporters) {
      this.routeToHandler(exporter, event);
    }

    if (this.autoExtractor && isTracingEvent(event)) {
      this.autoExtractor.processTracingEvent(event);
    }

    if (this.autoExtractor && event.type === 'score') {
      this.autoExtractor.processScoreEvent(event);
    }

    if (this.autoExtractor && event.type === 'feedback') {
      this.autoExtractor.processFeedbackEvent(event);
    }
  }
}

function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return event.type === 'span_started' || event.type === 'span_updated' || event.type === 'span_ended';
}
```

**Tasks:**
- [ ] Add enableAutoExtractedMetrics() to ObservabilityBus
- [ ] Add cross-emission for TracingEvent → MetricEvent
- [ ] Add cross-emission for ScoreEvent/FeedbackEvent → MetricEvent

---

## 3.2.5 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
private cardinalityFilter: CardinalityFilter;

constructor(config: ObservabilityConfig) {
  // ... existing setup
  this.cardinalityFilter = new CardinalityFilter(config.metrics?.cardinality);

  if (config.metrics?.enabled !== false) {
    this.observabilityBus.enableAutoExtractedMetrics();
  }
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
- [ ] Enable auto-extracted metrics on ObservabilityBus
- [ ] Add createMetricsContext method

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
- [ ] Test auto-extracted metrics from span events
- [ ] Test token metrics extraction
- [ ] Test environment fields go in metadata (not labels)
- [ ] Test DefaultExporter writes metrics
- [ ] Test JsonExporter outputs metrics
