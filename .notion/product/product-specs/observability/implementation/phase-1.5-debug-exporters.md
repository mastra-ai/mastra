# Phase 1.5: Debug Exporters

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation)
**Estimated Scope:** GrafanaCloudExporter and JsonExporter updates

---

## Overview

Phase 1.5 adds debug-friendly exporters for development and production visibility:
- GrafanaCloudExporter - Full T/M/L to Grafana Cloud (Tempo/Mimir/Loki)
- JsonExporter updates - Ensure all signals output for debugging

---

## Package Change Strategy

| PR | Package | Scope |
|----|---------|-------|
| PR 1.5.1 | `observability/grafana-cloud` (new) | GrafanaCloudExporter |
| PR 1.5.2 | `observability/mastra` | JsonExporter T/M/L support |

---

## PR 1.5.1: GrafanaCloudExporter

**Package:** `observability/grafana-cloud` (new package)
**Scope:** Export traces, metrics, and logs to Grafana Cloud

### 1.5.1.1 Package Setup

**Structure:**
```
observability/grafana-cloud/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── exporter.ts
│   ├── types.ts
│   └── formatters/
│       ├── traces.ts    (→ Tempo via OTLP)
│       ├── metrics.ts   (→ Mimir via Prometheus remote write)
│       └── logs.ts      (→ Loki via push API)
```

**Tasks:**
- [ ] Create package structure
- [ ] Set up package.json with dependencies
- [ ] Set up tsconfig.json

### 1.5.1.2 Configuration Types

**File:** `observability/grafana-cloud/src/types.ts`

```typescript
export interface GrafanaCloudExporterConfig {
  // Grafana Cloud instance
  instanceId: string;
  apiKey: string;

  // Optional: Override endpoints (defaults to Grafana Cloud URLs)
  tempoEndpoint?: string;   // Traces → Tempo
  mimirEndpoint?: string;   // Metrics → Mimir
  lokiEndpoint?: string;    // Logs → Loki

  // Optional: Batching
  batchSize?: number;
  flushIntervalMs?: number;
}
```

**Tasks:**
- [ ] Define config interface
- [ ] Define default endpoints

### 1.5.1.3 GrafanaCloudExporter Implementation

**File:** `observability/grafana-cloud/src/exporter.ts`

```typescript
import { BaseExporter, TracingEvent, MetricEvent, LogEvent } from '@mastra/observability';

export class GrafanaCloudExporter extends BaseExporter {
  readonly name = 'GrafanaCloudExporter';
  // Handler presence = signal support
  // Note: No onScoreEvent/onFeedbackEvent - Grafana doesn't have native score concept

  constructor(config: GrafanaCloudExporterConfig) {
    super();
    // Initialize clients for Tempo, Mimir, Loki
  }

  async onTracingEvent(event: TracingEvent): Promise<void> {
    // Format and send to Tempo via OTLP
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    // Format and send to Mimir via Prometheus remote write
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    // Format and send to Loki via push API
  }
}
```

**Tasks:**
- [ ] Implement GrafanaCloudExporter class
- [ ] Implement handlers for traces, metrics, logs
- [ ] Initialize endpoint clients

### 1.5.1.4 Traces → Tempo (OTLP)

**File:** `observability/grafana-cloud/src/formatters/traces.ts`

Grafana Tempo accepts OTLP format. We can reuse patterns from OtelExporter.

**Tasks:**
- [ ] Convert TracingEvent to OTLP span format
- [ ] Batch spans before sending
- [ ] Handle OTLP HTTP endpoint auth (Bearer token)
- [ ] Reference existing OtelExporter for patterns

### 1.5.1.5 Metrics → Mimir (Prometheus Remote Write)

**File:** `observability/grafana-cloud/src/formatters/metrics.ts`

Grafana Mimir accepts Prometheus remote write format.

```typescript
// Prometheus remote write format
interface WriteRequest {
  timeseries: TimeSeries[];
}

interface TimeSeries {
  labels: Label[];
  samples: Sample[];
}
```

**Tasks:**
- [ ] Convert MetricEvent to Prometheus TimeSeries
- [ ] Implement remote write protocol
- [ ] Handle Snappy compression (optional but recommended)
- [ ] Handle auth (Basic auth with instanceId:apiKey)

### 1.5.1.6 Logs → Loki (Push API)

**File:** `observability/grafana-cloud/src/formatters/logs.ts`

Grafana Loki accepts JSON push format.

```typescript
// Loki push format
interface LokiPushRequest {
  streams: LokiStream[];
}

interface LokiStream {
  stream: Record<string, string>;  // Labels
  values: [string, string][];      // [timestamp_ns, message]
}
```

**Tasks:**
- [ ] Convert LogEvent to Loki stream format
- [ ] Extract labels from log record (level, service, etc.)
- [ ] Batch logs before sending
- [ ] Handle auth (Basic auth)

### 1.5.1.7 Testing

**Tasks:**
- [ ] Unit tests for formatters
- [ ] Integration test with mock endpoints
- [ ] Test auth handling
- [ ] Test batching/flushing

---

## PR 1.5.2: JsonExporter Updates

**Package:** `observability/mastra`
**Scope:** Update JsonExporter to support all signals

### 1.5.2.1 Update JsonExporter

**File:** `observability/mastra/src/exporters/json.ts` (modify)

```typescript
export class JsonExporter extends BaseExporter {
  readonly name = 'JsonExporter';
  // Handler presence = signal support
  // Implements all handlers for debugging purposes

  async onTracingEvent(event: TracingEvent): Promise<void> {
    this.output('trace', event);
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.output('metric', event);
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    this.output('log', event);
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    this.output('score', event);
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    this.output('feedback', event);
  }

  private output(type: string, data: unknown): void {
    // Output to console or file based on config
    console.log(JSON.stringify({ type, timestamp: new Date().toISOString(), data }, null, 2));
  }
}
```

**Tasks:**
- [ ] Implement `onMetricEvent()` handler
- [ ] Implement `onLogEvent()` handler
- [ ] Implement `onScoreEvent()` handler
- [ ] Implement `onFeedbackEvent()` handler
- [ ] Support console and file output

### 1.5.2.2 Testing

**Tasks:**
- [ ] Test metric event output
- [ ] Test log event output
- [ ] Test JSON format correctness

---

## Dependencies

**External packages for GrafanaCloudExporter:**
- `snappy` or `snappyjs` - For Prometheus remote write compression (optional)
- HTTP client (use existing patterns)

**Internal dependencies:**
- `@mastra/core` - Types
- `@mastra/observability` - BaseExporter

---

## Definition of Done

- [ ] GrafanaCloudExporter package created and working
- [ ] JsonExporter outputs T/M/L events
- [ ] Documentation for GrafanaCloudExporter config
- [ ] Tests passing

---

## Notes

- GrafanaCloudExporter is high-priority for production debugging visibility
- Can start using immediately with Grafana Cloud free tier
- Mimir/Loki/Tempo are the backends; Grafana is the visualization layer
