# Phase 8: Third-Party Exporters

**Status:** Planning
**Prerequisites:** Phase 2 (Debug Exporters)
**Estimated Scope:** Expand existing exporters to support additional signals

---

## Overview

Phase 8 expands all existing third-party exporters to support the full signal set where applicable:
- OtelExporter: logs, metrics support
- LangfuseExporter: logs, scores, feedback support
- BraintrustExporter: logs, scores, feedback support
- LangSmithExporter: scores, feedback support
- DatadogExporter: logs, metrics support
- ArizeExporter: traces, scores support
- Other exporters: audit and expand

**Note:** This phase can start after Phase 2 (Debug Exporters) since exporters only need the Exported types. It can run in parallel with Phases 3-7.

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 8.1 | `observability/otel-exporter` | Logs, metrics support |
| PR 8.2 | `observability/langfuse` | Logs, scores, feedback support |
| PR 8.3 | `observability/braintrust` | Logs, scores, feedback support |
| PR 8.4 | `observability/langsmith` | Scores, feedback support |
| PR 8.5 | `observability/datadog` | Logs, metrics support |
| PR 8.6 | Other exporters | Audit and expand |

---

## PR 8.1: OtelExporter Expansion

**Package:** `observability/otel-exporter`
**Scope:** Add logs and metrics support

### 8.1.1 Current State Audit

**Tasks:**
- [ ] Audit current OtelExporter capabilities
- [ ] Review OTLP protocol for logs and metrics

### 8.1.2 Add Logs Support

```typescript
export class OtelExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onScoreEvent/onFeedbackEvent - OTLP doesn't have native scores

  private logExporter: OTLPLogExporter;

  async onLogEvent(event: LogEvent): Promise<void> {
    // Convert ExportedLog to OTLP LogRecord format
    const logRecord = {
      timeUnixNano: BigInt(new Date(event.log.timestamp).getTime() * 1_000_000),
      severityNumber: this.mapSeverity(event.log.level),
      severityText: event.log.level.toUpperCase(),
      body: { stringValue: event.log.message },
      attributes: this.toAttributes(event.log.data),
      traceId: this.hexToBytes(event.log.traceId),
      spanId: this.hexToBytes(event.log.spanId),
    };

    await this.logExporter.export([logRecord]);
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler
- [ ] Initialize OTLPLogExporter
- [ ] Map ExportedLog to OTLP format
- [ ] Handle trace correlation

### 8.1.3 Add Metrics Support

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  // Convert ExportedMetric to OTLP Metric format
  const metric = {
    name: event.metric.name,
    description: '',
    unit: '1',
    [event.metric.metricType]: {
      dataPoints: [{
        timeUnixNano: BigInt(new Date(event.metric.timestamp).getTime() * 1_000_000),
        [event.metric.metricType === 'histogram' ? 'sum' : 'asDouble']: event.metric.value,
        attributes: this.toAttributes(event.metric.labels),
      }],
    },
  };

  await this.metricExporter.export([metric]);
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler
- [ ] Initialize OTLPMetricExporter
- [ ] Map ExportedMetric to OTLP format
- [ ] Handle different metric types

### PR 8.1 Testing

**Tasks:**
- [ ] Test logs export to OTLP endpoint
- [ ] Test metrics export to OTLP endpoint
- [ ] Test with Jaeger/Grafana/other OTLP backends

---

## PR 8.2: LangfuseExporter Expansion

**Package:** `observability/langfuse`
**Scope:** Add logs, scores, and feedback support

### 8.2.1 Current State Audit

**Tasks:**
- [ ] Audit current LangfuseExporter capabilities
- [ ] Review Langfuse API for log/score/feedback support
- [ ] Identify API endpoints for each signal

### 8.2.2 Add Logs Support

```typescript
export class LangfuseExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent - Langfuse doesn't have metrics

  async onLogEvent(event: LogEvent): Promise<void> {
    // Langfuse logs can be attached to traces/spans as events
    await this.langfuse.event({
      traceId: event.log.traceId,
      name: 'log',
      level: event.log.level,
      input: event.log.message,
      metadata: {
        ...event.log.data,
        level: event.log.level,
        entityType: event.log.entityType,
        entityName: event.log.entityName,
      },
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Langfuse events API
- [ ] Handle trace correlation

### 8.2.3 Add Scores Support

```typescript
async onScoreEvent(event: ScoreEvent): Promise<void> {
  await this.langfuse.score({
    traceId: event.score.traceId,
    observationId: event.score.spanId,  // Optional
    name: event.score.scorerName,
    value: event.score.score,
    comment: event.score.reason,
    dataType: 'NUMERIC',
  });
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Handle both trace-level and span-level scores

### 8.2.4 Add Feedback Support

```typescript
async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  // Map feedback to Langfuse score (Langfuse uses scores for feedback)
  await this.langfuse.score({
    traceId: event.feedback.traceId,
    observationId: event.feedback.spanId,
    name: `feedback_${event.feedback.feedbackType}`,
    value: typeof event.feedback.value === 'number' ? event.feedback.value : 0,
    comment: event.feedback.comment,
    dataType: typeof event.feedback.value === 'number' ? 'NUMERIC' : 'CATEGORICAL',
  });
}
```

**Tasks:**
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Map feedback to Langfuse score API
- [ ] Handle numeric vs string feedback values

### PR 8.2 Testing

**Tasks:**
- [ ] Test logs appear in Langfuse
- [ ] Test scores appear in Langfuse
- [ ] Test feedback appears in Langfuse
- [ ] Integration test with real Langfuse instance

---

## PR 8.3: BraintrustExporter Expansion

**Package:** `observability/braintrust`
**Scope:** Add logs, scores, and feedback support

### 8.3.1 Current State Audit

**Tasks:**
- [ ] Audit current BraintrustExporter capabilities
- [ ] Review Braintrust API for log/score/feedback support
- [ ] Identify API endpoints for each signal

### 8.3.2 Add Logs Support

```typescript
export class BraintrustExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent - Braintrust doesn't have metrics

  async onLogEvent(event: LogEvent): Promise<void> {
    // Braintrust logs as span events
    await this.braintrust.log({
      spanId: event.log.spanId,
      message: event.log.message,
      level: event.log.level,
      metadata: event.log.data,
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Braintrust API
- [ ] Handle trace correlation

### 8.3.3 Add Scores Support

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Map ExportedScore to Braintrust scores API

### 8.3.4 Add Feedback Support

**Tasks:**
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Map ExportedFeedback to Braintrust feedback API
- [ ] Handle experiment grouping

### PR 8.3 Testing

**Tasks:**
- [ ] Test logs appear in Braintrust
- [ ] Test scores appear in Braintrust
- [ ] Test feedback appears in Braintrust

---

## PR 8.4: LangSmithExporter Expansion

**Package:** `observability/langsmith` (if exists)
**Scope:** Add scores and feedback support

### 8.4.1 Current State Audit

**Tasks:**
- [ ] Audit current LangSmithExporter capabilities
- [ ] Review LangSmith API for score/feedback support

### 8.4.2 Add Scores Support

```typescript
export class LangSmithExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent, no onLogEvent - LangSmith logs via traces

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    await this.langsmith.createFeedback({
      runId: event.score.traceId,
      key: event.score.scorerName,
      score: event.score.score,
      comment: event.score.reason,
    });
  }
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Map ExportedScore to LangSmith feedback API

### 8.4.3 Add Feedback Support

```typescript
async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  await this.langsmith.createFeedback({
    runId: event.feedback.traceId,
    key: event.feedback.feedbackType,
    score: typeof event.feedback.value === 'number' ? event.feedback.value : undefined,
    value: typeof event.feedback.value === 'string' ? event.feedback.value : undefined,
    comment: event.feedback.comment,
  });
}
```

**Tasks:**
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Map ExportedFeedback to LangSmith feedback API

### PR 8.4 Testing

**Tasks:**
- [ ] Test scores appear in LangSmith
- [ ] Test feedback appears in LangSmith

---

## PR 8.5: DatadogExporter Expansion

**Package:** `observability/datadog` (if exists, or create)
**Scope:** Add logs and metrics support

### 8.5.1 Current State Audit

**Tasks:**
- [ ] Check if DatadogExporter exists
- [ ] Review Datadog API for logs/metrics

### 8.5.2 Add Logs Support

```typescript
export class DatadogExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onScoreEvent/onFeedbackEvent - Datadog doesn't have native scores

  async onLogEvent(event: LogEvent): Promise<void> {
    // Datadog Log API
    await this.datadogClient.logIntake.submitLog({
      body: [{
        ddsource: 'mastra',
        ddtags: `env:${event.log.environment},service:${event.log.serviceName}`,
        hostname: this.hostname,
        message: event.log.message,
        service: event.log.serviceName,
        status: this.mapLevel(event.log.level),
        attributes: {
          traceId: event.log.traceId,
          spanId: event.log.spanId,
          ...event.log.data,
        },
      }],
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Datadog Log API
- [ ] Map log levels to Datadog status

### 8.5.3 Add Metrics Support

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  // Datadog Metrics API
  const timestamp = Math.floor(new Date(event.metric.timestamp).getTime() / 1000);

  await this.datadogClient.metricsApi.submitMetrics({
    body: {
      series: [{
        metric: event.metric.name,
        type: this.mapMetricType(event.metric.metricType),
        points: [[timestamp, event.metric.value]],
        tags: Object.entries(event.metric.labels).map(([k, v]) => `${k}:${v}`),
      }],
    },
  });
}

private mapMetricType(type: MetricType): 'gauge' | 'count' | 'rate' {
  switch (type) {
    case 'counter': return 'count';
    case 'gauge': return 'gauge';
    case 'histogram': return 'gauge';  // Datadog histograms handled differently
    default: return 'gauge';
  }
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler using Datadog Metrics API
- [ ] Map metric types correctly

### PR 8.5 Testing

**Tasks:**
- [ ] Test logs appear in Datadog
- [ ] Test metrics appear in Datadog
- [ ] Test trace correlation in Datadog

---

## PR 8.6: Other Exporters Audit

**Scope:** Audit remaining exporters and expand where applicable

### 8.6.1 Exporter Inventory

**Tasks:**
- [ ] List all exporters in `observability/` directory
- [ ] Document current signal support for each
- [ ] Identify expansion opportunities

### 8.6.2 Expansion Candidates

| Exporter | Traces | Metrics | Logs | Scores | Feedback | Notes |
|----------|--------|---------|------|--------|----------|-------|
| DefaultExporter | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 6 |
| JsonExporter | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 2 |
| CloudExporter | ✅ | ? | ? | ? | ? | Phase 7 |
| GrafanaCloudExporter | ✅ | ✅ | ✅ | ❌ | ❌ | Phase 2 |
| OtelExporter | ✅ | ✅ | ✅ | ❌ | ❌ | PR 8.1 |
| LangfuseExporter | ✅ | ❌ | ✅ | ✅ | ✅ | PR 8.2 |
| BraintrustExporter | ✅ | ❌ | ✅ | ✅ | ✅ | PR 8.3 |
| LangSmithExporter | ✅ | ❌ | ❌ | ✅ | ✅ | PR 8.4 |
| DatadogExporter | ✅ | ✅ | ✅ | ❌ | ❌ | PR 8.5 |
| ArizeExporter | ✅ | ❌ | ❌ | ✅ | ❌ | TBD |

**Tasks:**
- [ ] Update this table as exporters are expanded
- [ ] Document any exporters that can't support certain signals

### 8.6.3 Signal Support Matrix Documentation

**File:** `observability/README.md` or docs

Create a signal support matrix for users to reference when choosing exporters.

**Tasks:**
- [ ] Create signal support matrix documentation
- [ ] Document limitations of each exporter
- [ ] Provide guidance on exporter selection

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Logs appear in Langfuse
- [ ] E2E test: Logs appear in Datadog
- [ ] E2E test: Metrics appear in OTLP backend
- [ ] E2E test: Scores appear in LangSmith
- [ ] E2E test: Verify signal routing to correct exporters

---

## Dependencies Between PRs

PRs 8.1 through 8.6 can be done in parallel after Phase 2 is complete.

```
Phase 2 complete
    ↓
PR 8.1 (Otel)
PR 8.2 (Langfuse)    All can run in parallel
PR 8.3 (Braintrust)
PR 8.4 (LangSmith)
PR 8.5 (Datadog)
PR 8.6 (Others)
```

---

## Definition of Done

- [ ] All major exporters expanded to support additional signals
- [ ] Signal support matrix documented
- [ ] All tests pass
- [ ] Integration tests with real backends (where possible)

---

## Open Questions

1. Should we add a SentryExporter for error tracking?
2. Should we add a PrometheusExporter for metrics scraping?
3. How to handle exporters that don't support certain signals gracefully?
