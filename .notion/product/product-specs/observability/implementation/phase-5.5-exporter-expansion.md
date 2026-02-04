# Phase 5.5: Exporter Expansion

**Status:** Planning
**Prerequisites:** Phase 1-5
**Estimated Scope:** Expand existing exporters to support additional signals

---

## Overview

Phase 5.5 expands all existing exporters to support the full signal set where applicable:
- LangfuseExporter: logs, scores, feedback
- BraintrustExporter: logs, scores, feedback
- LangSmithExporter: scores, feedback
- DatadogExporter: logs, metrics
- OtelExporter: logs, metrics
- Other exporters: audit and expand

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 5.5.1 | `observability/langfuse` | Logs, scores, feedback support |
| PR 5.5.2 | `observability/braintrust` | Logs, scores, feedback support |
| PR 5.5.3 | `observability/langsmith` | Scores, feedback support |
| PR 5.5.4 | `observability/datadog` | Logs, metrics support |
| PR 5.5.5 | `observability/otel-exporter` | Logs, metrics support |
| PR 5.5.6 | Other exporters | Audit and expand |

---

## PR 5.5.1: LangfuseExporter Expansion

**Package:** `observability/langfuse`
**Scope:** Add logs, scores, and feedback support

### 5.5.1.1 Current State Audit

**Tasks:**
- [ ] Audit current LangfuseExporter capabilities
- [ ] Review Langfuse API for log/score/feedback support
- [ ] Identify API endpoints for each signal

### 5.5.1.2 Add Logs Support

```typescript
export class LangfuseExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent - Langfuse doesn't have metrics

  async onLogEvent(event: LogEvent): Promise<void> {
    // Langfuse logs can be attached to traces/spans as events
    // or sent as standalone observations
    await this.langfuse.event({
      traceId: event.record.traceId,
      name: 'log',
      level: event.record.level,
      input: event.record.message,
      metadata: {
        ...event.record.data,
        level: event.record.level,
        entityType: event.record.entityType,
        entityName: event.record.entityName,
      },
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Langfuse events API
- [ ] Handle trace correlation

### 5.5.1.3 Add Scores Support

Implement separate `onScoreEvent` handler:

```typescript
async onScoreEvent(event: ScoreEvent): Promise<void> {
  await this.langfuse.score({
    traceId: event.traceId,
    observationId: event.spanId,  // Optional
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

### 5.5.1.4 Add Feedback Support

```typescript
async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  // Map feedback to Langfuse score (Langfuse uses scores for feedback)
  await this.langfuse.score({
    traceId: event.traceId,
    observationId: event.spanId,
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

### PR 5.5.1 Testing

**Tasks:**
- [ ] Test logs appear in Langfuse
- [ ] Test scores appear in Langfuse
- [ ] Test feedback appears in Langfuse
- [ ] Integration test with real Langfuse instance

---

## PR 5.5.2: BraintrustExporter Expansion

**Package:** `observability/braintrust`
**Scope:** Add logs, scores, and feedback support

### 5.5.2.1 Current State Audit

**Tasks:**
- [ ] Audit current BraintrustExporter capabilities
- [ ] Review Braintrust API for log/score/feedback support
- [ ] Identify API endpoints for each signal

### 5.5.2.2 Add Logs Support

```typescript
export class BraintrustExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent - Braintrust doesn't have metrics

  async onLogEvent(event: LogEvent): Promise<void> {
    // Braintrust logs as span events
    await this.braintrust.log({
      spanId: event.record.spanId,
      message: event.record.message,
      level: event.record.level,
      metadata: event.record.data,
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Braintrust API
- [ ] Handle trace correlation

### 5.5.2.3 Add Scores Support

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Map to Braintrust scores API

### 5.5.2.4 Add Feedback Support

**Tasks:**
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Map feedback to Braintrust feedback API
- [ ] Handle experiment grouping

### PR 5.5.2 Testing

**Tasks:**
- [ ] Test logs appear in Braintrust
- [ ] Test scores appear in Braintrust
- [ ] Test feedback appears in Braintrust

---

## PR 5.5.3: LangSmithExporter Expansion

**Package:** `observability/langsmith` (if exists)
**Scope:** Add scores and feedback support

### 5.5.3.1 Current State Audit

**Tasks:**
- [ ] Audit current LangSmithExporter capabilities
- [ ] Review LangSmith API for score/feedback support

### 5.5.3.2 Add Scores Support

```typescript
export class LangSmithExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onMetricEvent, no onLogEvent - LangSmith logs via traces

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    await this.langsmith.createFeedback({
      runId: event.traceId,
      key: event.score.scorerName,
      score: event.score.score,
      comment: event.score.reason,
    });
  }
}
```

**Tasks:**
- [ ] Implement `onScoreEvent()` handler
- [ ] Map scores to LangSmith feedback API

### 5.5.3.3 Add Feedback Support

```typescript
async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
  await this.langsmith.createFeedback({
    runId: event.traceId,
    key: event.feedback.feedbackType,
    score: typeof event.feedback.value === 'number' ? event.feedback.value : undefined,
    value: typeof event.feedback.value === 'string' ? event.feedback.value : undefined,
    comment: event.feedback.comment,
  });
}
```

**Tasks:**
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Map feedback to LangSmith feedback API

### PR 5.5.3 Testing

**Tasks:**
- [ ] Test scores appear in LangSmith
- [ ] Test feedback appears in LangSmith

---

## PR 5.5.4: DatadogExporter Expansion

**Package:** `observability/datadog` (if exists, or create)
**Scope:** Add logs and metrics support

### 5.5.4.1 Current State Audit

**Tasks:**
- [ ] Check if DatadogExporter exists
- [ ] Review Datadog API for logs/metrics

### 5.5.4.2 Add Logs Support

```typescript
export class DatadogExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onScoreEvent/onFeedbackEvent - Datadog doesn't have native scores

  async onLogEvent(event: LogEvent): Promise<void> {
    // Datadog Log API
    await this.datadogClient.logIntake.submitLog({
      body: [{
        ddsource: 'mastra',
        ddtags: `env:${event.record.environment},service:${event.record.serviceName}`,
        hostname: this.hostname,
        message: event.record.message,
        service: event.record.serviceName,
        status: this.mapLevel(event.record.level),
        attributes: {
          traceId: event.record.traceId,
          spanId: event.record.spanId,
          ...event.record.data,
        },
      }],
    });
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler using Datadog Log API
- [ ] Map log levels to Datadog status

### 5.5.4.3 Add Metrics Support

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  // Datadog Metrics API
  const timestamp = Math.floor(event.timestamp.getTime() / 1000);

  await this.datadogClient.metricsApi.submitMetrics({
    body: {
      series: [{
        metric: event.name,
        type: this.mapMetricType(event.metricType),
        points: [[timestamp, event.value]],
        tags: Object.entries(event.labels).map(([k, v]) => `${k}:${v}`),
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

### PR 5.5.4 Testing

**Tasks:**
- [ ] Test logs appear in Datadog
- [ ] Test metrics appear in Datadog
- [ ] Test trace correlation in Datadog

---

## PR 5.5.5: OtelExporter Expansion

**Package:** `observability/otel-exporter`
**Scope:** Add logs and metrics support

### 5.5.5.1 Current State Audit

**Tasks:**
- [ ] Audit current OtelExporter capabilities
- [ ] Review OTLP protocol for logs and metrics

### 5.5.5.2 Add Logs Support

```typescript
export class OtelExporter extends BaseExporter {
  // Handler presence = signal support
  // Note: No onScoreEvent/onFeedbackEvent - OTLP doesn't have native scores

  private logExporter: OTLPLogExporter;

  constructor(config: OtelExporterConfig) {
    // Initialize OTLP exporters for each signal
    this.traceExporter = new OTLPTraceExporter(config);
    this.logExporter = new OTLPLogExporter(config);
    this.metricExporter = new OTLPMetricExporter(config);
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    // Convert to OTLP LogRecord format
    const logRecord = {
      timeUnixNano: BigInt(event.record.timestamp.getTime() * 1_000_000),
      severityNumber: this.mapSeverity(event.record.level),
      severityText: event.record.level.toUpperCase(),
      body: { stringValue: event.record.message },
      attributes: this.toAttributes(event.record.data),
      traceId: this.hexToBytes(event.record.traceId),
      spanId: this.hexToBytes(event.record.spanId),
    };

    await this.logExporter.export([logRecord]);
  }
}
```

**Tasks:**
- [ ] Implement `onLogEvent()` handler
- [ ] Initialize OTLPLogExporter
- [ ] Map LogRecord to OTLP format
- [ ] Handle trace correlation

### 5.5.5.3 Add Metrics Support

```typescript
async onMetricEvent(event: MetricEvent): Promise<void> {
  // Convert to OTLP Metric format
  const metric = {
    name: event.name,
    description: '',
    unit: '1',
    [event.metricType]: {
      dataPoints: [{
        timeUnixNano: BigInt(event.timestamp.getTime() * 1_000_000),
        [event.metricType === 'histogram' ? 'sum' : 'asDouble']: event.value,
        attributes: this.toAttributes(event.labels),
      }],
    },
  };

  await this.metricExporter.export([metric]);
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler
- [ ] Initialize OTLPMetricExporter
- [ ] Map MetricEvent to OTLP format
- [ ] Handle different metric types

### PR 5.5.5 Testing

**Tasks:**
- [ ] Test logs export to OTLP endpoint
- [ ] Test metrics export to OTLP endpoint
- [ ] Test with Jaeger/Grafana/other OTLP backends

---

## PR 5.5.6: Other Exporters Audit

**Scope:** Audit remaining exporters and expand where applicable

### 5.5.6.1 Exporter Inventory

**Tasks:**
- [ ] List all exporters in `observability/` directory
- [ ] Document current signal support for each
- [ ] Identify expansion opportunities

### 5.5.6.2 Expansion Candidates

| Exporter | Traces | Metrics | Logs | Scores | Feedback | Notes |
|----------|--------|---------|------|--------|----------|-------|
| DefaultExporter | ✅ | ✅ | ✅ | ✅ | ✅ | Done |
| JsonExporter | ✅ | ✅ | ✅ | ✅ | ✅ | Done |
| CloudExporter | ✅ | ? | ? | ? | ? | Depends on Cloud API |
| GrafanaCloudExporter | ✅ | ✅ | ✅ | ❌ | ❌ | Done (Phase 1.5) |
| LangfuseExporter | ✅ | ❌ | ✅ | ✅ | ✅ | PR 5.5.1 |
| BraintrustExporter | ✅ | ❌ | ✅ | ✅ | ✅ | PR 5.5.2 |
| LangSmithExporter | ✅ | ❌ | ❌ | ✅ | ✅ | PR 5.5.3 |
| DatadogExporter | ✅ | ✅ | ✅ | ❌ | ❌ | PR 5.5.4 |
| OtelExporter | ✅ | ✅ | ✅ | ❌ | ❌ | PR 5.5.5 |

**Tasks:**
- [ ] Update this table as exporters are expanded
- [ ] Document any exporters that can't support certain signals

### 5.5.6.3 Signal Support Matrix Documentation

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

PRs 5.5.1 through 5.5.6 can be done in parallel after Phase 5 is complete.

```
Phase 5 complete
    ↓
PR 5.5.1 (Langfuse)
PR 5.5.2 (Braintrust)   All can run in parallel
PR 5.5.3 (LangSmith)
PR 5.5.4 (Datadog)
PR 5.5.5 (Otel)
PR 5.5.6 (Others)
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
