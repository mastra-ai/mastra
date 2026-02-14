# PR 3.3: Auto-Extracted Metrics

**Package:** `observability/mastra`
**Scope:** TracingEvent → MetricEvent auto-extraction (cross-emission)
**Prerequisites:** PR 3.2 (MetricsContext)

---

## 3.3.1 AutoExtractedMetrics Class

**File:** `observability/mastra/src/metrics/auto-extract.ts` (new)

```typescript
import type { TracingEvent, TracingEventType, ExportedMetric, MetricEvent, AnyExportedSpan } from '@mastra/core';
import { ObservabilityBus } from '../bus/observability';

export class AutoExtractedMetrics {
  constructor(private observabilityBus: ObservabilityBus) {}

  processTracingEvent(event: TracingEvent): void {
    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        this.onSpanStarted(event.exportedSpan);
        break;
      case TracingEventType.SPAN_ENDED:
        this.onSpanEnded(event.exportedSpan);
        break;
    }
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
- [ ] Extract token usage metrics from MODEL_GENERATION spans
- [ ] Use TracingEventType enum (not string literals)

---

## 3.3.2 Update ObservabilityBus for Auto-Extraction

**File:** `observability/mastra/src/bus/observability.ts` (modify)

```typescript
import { TracingEventType } from '@mastra/core';

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

    // Score/feedback → metric cross-emission added in PR 3.4
  }
}

function isTracingEvent(event: ObservabilityEvent): event is TracingEvent {
  return (
    event.type === TracingEventType.SPAN_STARTED ||
    event.type === TracingEventType.SPAN_UPDATED ||
    event.type === TracingEventType.SPAN_ENDED
  );
}
```

**Tasks:**
- [ ] Add enableAutoExtractedMetrics() to ObservabilityBus
- [ ] Add isTracingEvent helper using TracingEventType enum
- [ ] Add cross-emission for TracingEvent → MetricEvent

---

## 3.3.3 Update BaseObservabilityInstance

**File:** `observability/mastra/src/instances/base.ts` (modify)

```typescript
constructor(config: ObservabilityConfig) {
  // ... existing setup from PR 3.2a

  // Enable auto-extracted metrics
  if (config.metrics?.enabled !== false) {
    this.observabilityBus.enableAutoExtractedMetrics();
  }
}
```

**Tasks:**
- [ ] Enable auto-extracted metrics in constructor

---

## PR 3.3 Testing

**Tasks:**
- [ ] Test auto-extracted metrics from SPAN_STARTED events
- [ ] Test auto-extracted metrics from SPAN_ENDED events
- [ ] Test duration histogram calculation
- [ ] Test token metrics extraction from MODEL_GENERATION spans
- [ ] Test cache token metrics (cacheRead, cacheWrite)
- [ ] Test metrics appear in JsonExporter output
- [ ] Test metrics NOT emitted for unsupported span types
