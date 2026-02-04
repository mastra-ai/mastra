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

