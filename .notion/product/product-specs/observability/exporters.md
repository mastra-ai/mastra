# Exporters

Observability exporters for sending telemetry data to various backends.

---

## Overview

Mastra supports multiple observability backends through dedicated exporter packages. Each exporter **declares which signals it supports** (Traces, Metrics, Logs) and only receives the signals it can handle. This unified model allows mixing exporters for different purposes.

---

## Exporter Interface

All exporters implement a common interface that declares signal support:

```typescript
interface ObservabilityExporter {
  readonly name: string;

  // Declare supported signals
  readonly supportsTraces: boolean;
  readonly supportsMetrics: boolean;
  readonly supportsLogs: boolean;

  // Signal-specific export methods (implement those you support)
  exportSpans?(spans: Span[]): Promise<void>;
  exportMetrics?(metrics: MetricEvent[]): Promise<void>;
  exportLogs?(logs: LogRecord[]): Promise<void>;

  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
```

---

## Signal Support Matrix

Each exporter declares which signals it handles:

| Exporter | Traces | Metrics | Logs | Destination |
|----------|:------:|:-------:|:----:|-------------|
| **DefaultExporter** | ✓ | ✓ | ✓ | Storage (LibSQL/PG/ClickHouse) |
| **CloudExporter** | ✓ | ✓ | ✓ | Mastra Cloud |
| **GrafanaCloudExporter** | ✓ | ✓ | ✓ | Grafana Cloud (Tempo/Mimir/Loki) |
| **OtelExporter** | ✓ | ✓ | ✓ | Any OTLP endpoint |
| **OtelBridge** | ✓ | ✓ | ✓ | OTEL SDK → your exporters |
| **DatadogExporter** | ✓ | ✓ | ✓ | Datadog APIs |
| **PinoExporter** | ✗ | ✗ | ✓ | Console (pretty) / File |
| **WinstonExporter** | ✗ | ✗ | ✓ | Console / File / Transports |
| **ConsoleExporter** | ✓ | ✗ | ✓ | Console (debug) |
| **SentryExporter** | ✓ | ✗ | ✓ | Sentry |
| **PostHogExporter** | ✓ | ✗ | ✓ | PostHog |
| **LangfuseExporter** | ✓ | ✗ | ✗ | Langfuse |
| **BraintrustExporter** | ✓ | ✗ | ✓ | Braintrust |
| **LangSmithExporter** | ✓ | ✗ | ✗ | LangSmith |
| **ArizeExporter** | ✓ | ✗ | ✗ | Arize AI |
| **LaminarExporter** | ✓ | ✗ | ✗ | Laminar |

**Note:** LLM observability platforms (Langfuse, Braintrust, etc.) compute their own metrics from trace data—they don't accept metrics directly.

### Score & Feedback Support

Some exporters also support evaluation scores and user feedback events:

| Exporter | Scores | Feedback | Notes |
|----------|:------:|:--------:|-------|
| **DefaultExporter** | ✓ | ✓ | Persists to storage for Studio |
| **CloudExporter** | ✓ | ✓ | Sends to Mastra Cloud |
| **LangfuseExporter** | ✓ | ✓ | Maps to Langfuse scores |
| **BraintrustExporter** | ✓ | ✓ | Maps to Braintrust scores |
| **LangSmithExporter** | ✓ | ✓ | Maps to LangSmith feedback |
| **OtelExporter** | ✗ | ✗ | OTLP has no score concept |
| **PinoExporter** | ✗ | ✗ | Log-only exporter |

→ See [Tracing - Scores](./tracing.md#scores) for score/feedback event details

---

## Exporter Categories

Exporters fall into three categories based on their signal support:

### Full Observability Exporters (T + M + L)

These exporters support all three signals and are suitable for comprehensive telemetry:

- **DefaultExporter** - Storage backends
- **CloudExporter** - Mastra Cloud
- **GrafanaCloudExporter** - Grafana Cloud (with built-in alerting)
- **OtelExporter** - OTLP endpoints
- **DatadogExporter** - Datadog

### Traces + Logs Exporters (T + L)

These exporters support traces and logs but not metrics:

- **BraintrustExporter** - Braintrust eval platform
- **ConsoleExporter** - Debug output
- **SentryExporter** - Error tracking
- **PostHogExporter** - Product analytics

### Log-Only Exporters (L)

These exporters only handle logs and replace the deprecated top-level `logger` config:

- **PinoExporter** - Pretty console output, file logging
- **WinstonExporter** - Flexible transports

### Trace-Only Exporters (T)

LLM observability platforms that compute metrics from traces:

- **LangfuseExporter**
- **LangSmithExporter**
- **ArizeExporter**
- **LaminarExporter**

---

## Exporter Descriptions

### DefaultExporter

Persists all telemetry (traces, metrics, logs) to Mastra's storage layer for use in **Mastra Studio**. Supports multiple strategies (realtime, batch-with-updates, insert-only) depending on the backend.

```typescript
import { DefaultExporter } from '@mastra/observability';

exporters: [new DefaultExporter()]
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

### CloudExporter

Sends all telemetry to Mastra Cloud for managed observability.

```typescript
import { CloudExporter } from '@mastra/observability';

exporters: [new CloudExporter()]
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

### PinoExporter

Pretty-printed console logging using Pino. Replaces the deprecated top-level `logger` config. Only handles logs—no traces or metrics.

```typescript
import { PinoExporter } from '@mastra/observability';

exporters: [
  new PinoExporter({
    level: 'info',
    pretty: true,
  })
]
```

**Signals:** Traces ✗ | Metrics ✗ | Logs ✓

### WinstonExporter

Flexible logging using Winston with support for multiple transports (console, file, external services). Only handles logs.

```typescript
import { WinstonExporter } from '@mastra/observability';

exporters: [
  new WinstonExporter({
    level: 'info',
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'app.log' }),
    ],
  })
]
```

**Signals:** Traces ✗ | Metrics ✗ | Logs ✓

### ConsoleExporter

Simple console output for development debugging. Supports traces and logs.

```typescript
import { ConsoleExporter } from '@mastra/observability';

exporters: [new ConsoleExporter()]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✓

### GrafanaCloudExporter

Exports all telemetry to Grafana Cloud's managed observability stack:
- **Traces** → Grafana Tempo
- **Metrics** → Grafana Mimir (Prometheus-compatible)
- **Logs** → Grafana Loki

Grafana Cloud provides built-in alerting, dashboards, and integrations with PagerDuty, OpsGenie, Slack, etc.

```typescript
import { GrafanaCloudExporter } from '@mastra/grafana-cloud';

exporters: [
  new GrafanaCloudExporter({
    instanceId: process.env.GRAFANA_INSTANCE_ID,
    apiKey: process.env.GRAFANA_API_KEY,
    // Optional: customize endpoints
    tempoEndpoint: 'https://tempo-us-central1.grafana.net',
    mimirEndpoint: 'https://mimir-us-central1.grafana.net',
    lokiEndpoint: 'https://logs-us-central1.grafana.net',
  })
]
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

**Benefits:**
- Unified dashboards for all three signals
- Built-in alerting with flexible routing
- No infrastructure to manage
- Prometheus-compatible metrics querying (PromQL)
- LogQL for log exploration

→ See [Metrics - Alerting](./metrics.md#alerting) for alert rule examples

### OtelExporter

Exports to any OTLP-compatible endpoint. Works with Jaeger, Grafana Tempo, New Relic, SigNoz, Honeycomb, Grafana Mimir/Loki, and any other OpenTelemetry-compatible collector.

```typescript
import { OtelExporter } from '@mastra/otel-exporter';

exporters: [
  new OtelExporter({
    endpoint: 'http://localhost:4318',
  })
]
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

### DatadogExporter

Full integration with Datadog's observability platform. Datadog accepts traces, metrics, and logs via their API.

```typescript
import { DatadogExporter } from '@mastra/datadog';

exporters: [
  new DatadogExporter({
    apiKey: process.env.DD_API_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

### LangfuseExporter

Exports traces to Langfuse for LLM observability. Langfuse computes its own metrics (cost, latency, token usage) from trace data.

```typescript
import { LangfuseExporter } from '@mastra/langfuse';

exporters: [
  new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✗

### BraintrustExporter

Exports traces and logs to Braintrust for evaluation and observability. Braintrust computes metrics from trace data and supports log ingestion.

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

exporters: [
  new BraintrustExporter({
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✓

### LangSmithExporter

Exports traces to LangSmith for LLM application monitoring. LangSmith computes metrics from trace data.

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

exporters: [
  new LangSmithExporter({
    apiKey: process.env.LANGSMITH_API_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✗

### ArizeExporter

Exports traces to Arize AI using the OpenInference format for ML observability.

```typescript
import { ArizeExporter } from '@mastra/arize';

exporters: [
  new ArizeExporter({
    apiKey: process.env.ARIZE_API_KEY,
    spaceKey: process.env.ARIZE_SPACE_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✗

### LaminarExporter

Exports traces to Laminar for LLM observability and prompt management.

```typescript
import { LaminarExporter } from '@mastra/laminar';

exporters: [
  new LaminarExporter({
    apiKey: process.env.LAMINAR_API_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✗

### PostHogExporter

Exports traces and logs to PostHog as events for product analytics integration.

```typescript
import { PostHogExporter } from '@mastra/posthog';

exporters: [
  new PostHogExporter({
    apiKey: process.env.POSTHOG_API_KEY,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✓

### SentryExporter

Exports traces and logs to Sentry for error tracking and performance monitoring.

```typescript
import { SentryExporter } from '@mastra/sentry';

exporters: [
  new SentryExporter({
    dsn: process.env.SENTRY_DSN,
  })
]
```

**Signals:** Traces ✓ | Metrics ✗ | Logs ✓

### OtelBridge

Bidirectional integration with the OpenTelemetry SDK. Creates real OTEL spans when Mastra spans are created, which then flow through your configured OTEL exporters/processors. Also maintains context propagation so OTEL-instrumented code (DB clients, HTTP clients) within Mastra spans have correct parent-child relationships.

```typescript
import { OtelBridge } from '@mastra/otel-bridge';

// Bridge receives spans, doesn't export them
const bridge = new OtelBridge();
```

**Signals:** Traces ✓ | Metrics ✓ | Logs ✓

---

## Bridges vs Exporters

Bridges provide bidirectional integration with external systems, unlike exporters which only send data out.

| Feature | Bridges | Exporters |
|---------|---------|-----------|
| Creates native spans in external systems | Yes | No |
| Inherits context from external systems | Yes | No |
| Sends data to backends | Via external SDK | Directly |
| Use case | Existing distributed tracing | Standalone Mastra tracing |

---

## Multiple Exporters

You can use multiple exporters simultaneously. Each signal is sent to all exporters that support it. This allows mixing:

- Storage for Studio/querying
- Cloud for managed observability
- Console for dev visibility
- External platforms for specific features

```typescript
observability: new Observability({
  configs: {
    default: {
      serviceName: "my-app",
      exporters: [
        new DefaultExporter(),     // T ✓  M ✓  L ✓  → Storage (queryable)
        new CloudExporter(),       // T ✓  M ✓  L ✓  → Mastra Cloud
        new PinoExporter({         // T ✗  M ✗  L ✓  → Console (pretty)
          level: 'info',
          pretty: true,
        }),
        new LangfuseExporter(),    // T ✓  M ✗  L ✗  → Langfuse
      ],
    },
  },
})
```

In this example:
- **Traces** go to: DefaultExporter, CloudExporter, LangfuseExporter
- **Metrics** go to: DefaultExporter, CloudExporter
- **Logs** go to: DefaultExporter, CloudExporter, PinoExporter

---

## ComposableExporter

Similar to Mastra's composable storage pattern, `ComposableExporter` lets you delegate different signals to different exporters in a single wrapper:

```typescript
import { ComposableExporter } from '@mastra/observability';

const otel = new OtelExporter();

exporters: [
  new ComposableExporter({
    traces: [otel, new ConsoleExporter()],
    metrics: [otel],
    logs: [new PinoExporter(), otel],
  }),
]
```

### Use Cases

- **Best-of-breed per signal** - Use specialized platforms for each signal type
- **Migration** - Gradually move signals to a new backend without changing config structure
- **Cost optimization** - Route high-volume signals (metrics) to cheaper storage
- **Compliance** - Send sensitive logs to a different destination than traces

### Behavior

- Each signal routes to all exporters in its list
- `flush()` and `shutdown()` propagate to all child exporters
- If a signal's list is empty or not configured, that signal is dropped (with warning)
- Composable exporters can be nested or mixed with regular exporters

```typescript
exporters: [
  new DefaultExporter(),           // T ✓  M ✓  L ✓  → Storage (all signals)
  new ComposableExporter({         // Route to specialized platforms
    traces: [new BraintrustExporter()],
    metrics: [new GrafanaCloudExporter()],
    // logs: not configured → uses DefaultExporter above
  }),
]
```

---

## Migration from Top-Level Logger

The `logger` property at the Mastra config level is deprecated. Use a log exporter instead:

```typescript
// BEFORE (deprecated)
const mastra = new Mastra({
  logger: new PinoLogger({ level: 'info' }),
  observability: new Observability({ ... }),
});

// AFTER
const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        exporters: [
          new DefaultExporter(),
          new PinoExporter({ level: 'info' }),  // Replaces top-level logger
        ],
      },
    },
  }),
});
```

This unified model ensures:
- All signals flow through the same configuration
- Logs are auto-correlated with traces (traceId, spanId)
- No confusion about separate logger vs observability config

---

## Related Documents

- [Observability](./README.md) (parent)
- [Tracing](./tracing.md)
- [Architecture & Configuration](./architecture-configuration.md)
- [Plan Analysis](./plan-analysis.md) - Competitive context for exporter choices
