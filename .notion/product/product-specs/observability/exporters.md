# Exporters

Observability exporters for sending telemetry data to various backends.

---

## Overview

Mastra supports multiple observability backends through dedicated exporter packages. Each exporter translates Mastra's internal telemetry format to the target platform's API.

---

## Platform Support Matrix

What each platform accepts at the API level:

| Exporter | Traces | Metrics | Logs | Notes |
|----------|--------|---------|------|-------|
| **DefaultExporter** | Yes | Planned | Planned | Mastra storage (LibSQL, PostgreSQL, ClickHouse) |
| **CloudExporter** | Yes | Planned | Planned | Mastra Cloud |
| **otel-exporter** | Yes | Planned | Planned | Generic OTLP endpoints (Jaeger, Grafana, etc.) |
| **otel-bridge** | Yes | Planned | Planned | Creates OTEL spans -> your OTEL exporters |
| **datadog** | Yes | Yes | Yes | Full observability platform |
| **sentry** | Yes | TBD | Planned | Error tracking + logs |
| **posthog** | Yes | TBD | Planned | Product analytics + logs |
| **langfuse** | Yes | No | TBD | Computes metrics from traces |
| **braintrust** | Yes | No | TBD | Computes metrics from traces |
| **langsmith** | Yes | TBD | TBD | LLM application monitoring |
| **arize** | Yes | TBD | TBD | OpenInference format |
| **laminar** | Yes | TBD | TBD | LLM observability |

**Legend:**
- Yes = Currently supported
- Planned = Pending metrics/logging implementation
- TBD = Platform may support, needs investigation
- No = Platform doesn't accept this signal type directly

---

## Exporter Descriptions

### DefaultExporter

Persists telemetry to Mastra's storage layer for use in **Mastra Studio**. Supports multiple strategies (realtime, batch-with-updates, insert-only) depending on the backend.

```typescript
import { DefaultExporter } from '@mastra/observability';

exporters: [new DefaultExporter()]
```

### CloudExporter

Sends telemetry to Mastra Cloud for managed observability.

```typescript
import { CloudExporter } from '@mastra/observability';

exporters: [new CloudExporter()]
```

### otel-exporter

Exports to any OTLP-compatible endpoint. Works with Jaeger, Grafana Tempo, New Relic, SigNoz, Honeycomb, and any other OpenTelemetry-compatible collector.

```typescript
import { OTelExporter } from '@mastra/otel-exporter';

exporters: [
  new OTelExporter({
    endpoint: 'http://localhost:4318',
  })
]
```

### datadog

Full integration with Datadog's observability platform. Datadog accepts traces, metrics, and logs via their API.

```typescript
import { DatadogExporter } from '@mastra/datadog';

exporters: [
  new DatadogExporter({
    apiKey: process.env.DD_API_KEY,
  })
]
```

### langfuse

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

### braintrust

Exports traces to Braintrust for evaluation and observability. Braintrust computes metrics from trace data.

```typescript
import { BraintrustExporter } from '@mastra/braintrust';

exporters: [
  new BraintrustExporter({
    apiKey: process.env.BRAINTRUST_API_KEY,
  })
]
```

### langsmith

Exports traces to LangSmith for LLM application monitoring. LangSmith computes metrics from trace data.

```typescript
import { LangSmithExporter } from '@mastra/langsmith';

exporters: [
  new LangSmithExporter({
    apiKey: process.env.LANGSMITH_API_KEY,
  })
]
```

### arize

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

### laminar

Exports traces to Laminar for LLM observability and prompt management.

```typescript
import { LaminarExporter } from '@mastra/laminar';

exporters: [
  new LaminarExporter({
    apiKey: process.env.LAMINAR_API_KEY,
  })
]
```

### posthog

Exports traces to PostHog as events for product analytics integration.

```typescript
import { PostHogExporter } from '@mastra/posthog';

exporters: [
  new PostHogExporter({
    apiKey: process.env.POSTHOG_API_KEY,
  })
]
```

### sentry

Exports traces to Sentry for error tracking and performance monitoring.

```typescript
import { SentryExporter } from '@mastra/sentry';

exporters: [
  new SentryExporter({
    dsn: process.env.SENTRY_DSN,
  })
]
```

### otel-bridge

Bidirectional integration with the OpenTelemetry SDK. Creates real OTEL spans when Mastra spans are created, which then flow through your configured OTEL exporters/processors. Also maintains context propagation so OTEL-instrumented code (DB clients, HTTP clients) within Mastra spans have correct parent-child relationships.

```typescript
import { OTelBridge } from '@mastra/otel-bridge';

// Bridge receives spans, doesn't export them
const bridge = new OTelBridge();
```

---

## Multiple Exporters

You can use multiple exporters simultaneously:

```typescript
observability: new Observability({
  configs: {
    default: {
      serviceName: "my-app",
      exporters: [
        new DefaultExporter(),     // Local storage
        new CloudExporter(),       // Mastra Cloud
        new LangfuseExporter(),    // Langfuse for LLM analytics
      ],
    },
  },
})
```

---

## Future: Metrics & Logging Export

Platforms that accept metrics and/or logs at the API level will receive them once Mastra's metrics and logging systems are implemented:

**Full observability (traces + metrics + logs):**
- **DefaultExporter** -> Storage
- **CloudExporter** -> Mastra Cloud
- **otel-exporter** -> OTLP endpoints (Grafana Mimir/Loki, etc.)
- **otel-bridge** -> OTEL SDK -> your configured exporters
- **datadog** -> Datadog APIs

**Traces + logs (planned):**
- **sentry** -> Sentry
- **posthog** -> PostHog

**Traces only (metrics computed from traces):**
- **langfuse**, **braintrust** - These platforms compute metrics internally from trace data; they don't accept metrics directly

**Needs investigation:**
- **langsmith**, **arize**, **laminar** - May support additional signals at the API level

---

## Related Documents

- [Observability](./README.md) (parent)
- [Tracing](./tracing.md)
- [Architecture & Configuration](./architecture-configuration.md)
