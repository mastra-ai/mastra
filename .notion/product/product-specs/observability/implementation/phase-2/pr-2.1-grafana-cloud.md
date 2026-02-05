# PR 2.1: GrafanaCloudExporter

**Package:** `observability/grafana-cloud` (new package)
**Scope:** Export traces, metrics, and logs to Grafana Cloud

---

## 2.1.1 Package Setup

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

---

## 2.1.2 Configuration Types

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

---

## 2.1.3 GrafanaCloudExporter Implementation

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
    // event.span is AnyExportedSpan (serializable)
    // Format and send to Tempo via OTLP
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    // event.metric is ExportedMetric (serializable)
    // Format and send to Mimir via Prometheus remote write
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    // event.log is ExportedLog (serializable)
    // Format and send to Loki via push API
  }
}
```

**Tasks:**
- [ ] Implement GrafanaCloudExporter class
- [ ] Implement handlers for traces, metrics, logs
- [ ] Initialize endpoint clients

---

## 2.1.4 Traces → Tempo (OTLP)

**File:** `observability/grafana-cloud/src/formatters/traces.ts`

Grafana Tempo accepts OTLP format. We can reuse patterns from OtelExporter.

**Tasks:**
- [ ] Convert AnyExportedSpan to OTLP span format
- [ ] Batch spans before sending
- [ ] Handle OTLP HTTP endpoint auth (Bearer token)
- [ ] Reference existing OtelExporter for patterns

---

## 2.1.5 Metrics → Mimir (Prometheus Remote Write)

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
- [ ] Convert ExportedMetric to Prometheus TimeSeries
- [ ] Implement remote write protocol
- [ ] Handle Snappy compression (optional but recommended)
- [ ] Handle auth (Basic auth with instanceId:apiKey)

---

## 2.1.6 Logs → Loki (Push API)

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
- [ ] Convert ExportedLog to Loki stream format
- [ ] Extract labels from log (level, service, etc.)
- [ ] Batch logs before sending
- [ ] Handle auth (Basic auth)

---

## PR 2.1 Testing

**Tasks:**
- [ ] Unit tests for formatters
- [ ] Integration test with mock endpoints
- [ ] Test auth handling
- [ ] Test batching/flushing

---

## Dependencies

**External packages:**
- `snappy` or `snappyjs` - For Prometheus remote write compression (optional)
- HTTP client (use existing patterns)

**Internal dependencies:**
- `@mastra/core` - Types (Exported types)
- `@mastra/observability` - BaseExporter
