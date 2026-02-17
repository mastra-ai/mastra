# @mastra/grafana

Grafana observability exporter for Mastra. Exports traces, metrics, and logs to the Grafana stack — both [Grafana Cloud](https://grafana.com/products/cloud/) and self-hosted deployments.

| Signal  | Backend        | Protocol          | Endpoint              |
| ------- | -------------- | ----------------- | --------------------- |
| Traces  | Grafana Tempo  | OTLP/HTTP JSON    | `/v1/traces`          |
| Metrics | Grafana Mimir  | OTLP/HTTP JSON    | `/v1/metrics`         |
| Logs    | Grafana Loki   | JSON push API     | `/loki/api/v1/push`   |

## Installation

```bash
npm install @mastra/grafana
```

## Usage

### Grafana Cloud

The `grafanaCloud()` helper constructs zone-based endpoints and Basic auth from your instance credentials.

#### Zero-Config Setup

```bash
# Required
GRAFANA_CLOUD_INSTANCE_ID=123456
GRAFANA_CLOUD_API_KEY=glc_...

# Optional — defaults to prod-us-central-0
GRAFANA_CLOUD_ZONE=prod-us-central-0
```

```typescript
import { Mastra } from '@mastra/core';
import { GrafanaExporter, grafanaCloud } from '@mastra/grafana';

const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        exporters: [new GrafanaExporter(grafanaCloud())],
      },
    },
  },
});
```

#### Explicit Configuration

```typescript
import { GrafanaExporter, grafanaCloud } from '@mastra/grafana';

const exporter = new GrafanaExporter(grafanaCloud({
  instanceId: '123456',
  apiKey: 'glc_...',
  zone: 'prod-eu-west-0',
}));
```

### Self-Hosted Grafana Stack

The `grafana()` helper configures endpoints and auth for self-hosted Tempo, Mimir, and Loki.

#### Local Development (No Auth)

```typescript
import { GrafanaExporter, grafana } from '@mastra/grafana';

const exporter = new GrafanaExporter(grafana({
  tempoEndpoint: 'http://localhost:4318',
  mimirEndpoint: 'http://localhost:9090/otlp',
  lokiEndpoint: 'http://localhost:3100',
}));
```

#### Zero-Config Setup

```bash
GRAFANA_TEMPO_ENDPOINT=http://tempo:4318
GRAFANA_MIMIR_ENDPOINT=http://mimir:9090/otlp
GRAFANA_LOKI_ENDPOINT=http://loki:3100
```

```typescript
const exporter = new GrafanaExporter(grafana());
```

#### With Bearer Token Auth

```typescript
import { GrafanaExporter, grafana } from '@mastra/grafana';

const exporter = new GrafanaExporter(grafana({
  tempoEndpoint: 'https://tempo.internal.example.com',
  mimirEndpoint: 'https://mimir.internal.example.com/otlp',
  lokiEndpoint: 'https://loki.internal.example.com',
  auth: { type: 'bearer', token: process.env.GRAFANA_TOKEN },
  tenantId: 'my-org',
}));
```

### Partial Signal Export

You can configure only the endpoints you need. Signals without an endpoint are silently skipped.

```typescript
// Traces only — no metrics or logs
const exporter = new GrafanaExporter(grafana({
  tempoEndpoint: 'http://localhost:4318',
}));
```

## Configuration Reference

### `grafanaCloud()` Options

| Option          | Type     | Description                                      | Default                               |
| --------------- | -------- | ------------------------------------------------ | ------------------------------------- |
| `instanceId`    | `string` | Grafana Cloud instance ID                        | `GRAFANA_CLOUD_INSTANCE_ID` env var   |
| `apiKey`        | `string` | Grafana Cloud API key / service account token    | `GRAFANA_CLOUD_API_KEY` env var       |
| `zone`          | `string` | Cloud zone (e.g., `prod-eu-west-0`)              | `GRAFANA_CLOUD_ZONE` or `prod-us-central-0` |
| `tempoEndpoint` | `string` | Override default Tempo endpoint                  | `https://otlp-gateway-{zone}.grafana.net/otlp` |
| `mimirEndpoint` | `string` | Override default Mimir endpoint                  | `https://otlp-gateway-{zone}.grafana.net/otlp` |
| `lokiEndpoint`  | `string` | Override default Loki endpoint                   | `https://logs-{zone}.grafana.net`     |

### `grafana()` Options

| Option          | Type          | Description                              | Default                          |
| --------------- | ------------- | ---------------------------------------- | -------------------------------- |
| `tempoEndpoint` | `string`      | Tempo endpoint for traces                | `GRAFANA_TEMPO_ENDPOINT` env var |
| `mimirEndpoint` | `string`      | Mimir endpoint for metrics               | `GRAFANA_MIMIR_ENDPOINT` env var |
| `lokiEndpoint`  | `string`      | Loki endpoint for logs                   | `GRAFANA_LOKI_ENDPOINT` env var  |
| `auth`          | `GrafanaAuth` | Authentication (`basic`, `bearer`, `custom`, `none`) | `{ type: 'none' }` |
| `tenantId`      | `string`      | Multi-tenant org ID (`X-Scope-OrgID` header) | —                            |

### `GrafanaExporter` Options

| Option           | Type          | Description                                   | Default           |
| ---------------- | ------------- | --------------------------------------------- | ----------------- |
| `batchSize`      | `number`      | Max items buffered before flush (per signal)  | `100`             |
| `flushIntervalMs`| `number`      | Periodic flush interval in ms                 | `5000`            |
| `serviceName`    | `string`      | Service name for resource attributes          | `'mastra-service'`|

### Auth Types

```typescript
// Basic auth (used by Grafana Cloud)
{ type: 'basic', username: string, password: string }

// Bearer token
{ type: 'bearer', token: string }

// Custom headers (e.g., reverse proxy)
{ type: 'custom', headers: Record<string, string> }

// No auth (local development)
{ type: 'none' }
```

## Features

### Tracing

- **Completion-only pattern**: Spans are exported on `SPAN_ENDED` for efficient tracing
- **OTLP-compliant**: Full OTLP/HTTP JSON format compatible with Tempo
- **GenAI attributes**: Model generation spans include `gen_ai.*` semantic attributes
- **Metadata mapping**: Span metadata exported as `mastra.metadata.*` attributes
- **Error tracking**: Error spans include exception events and error status

### Metrics

- **OTLP format**: Metrics exported via Mimir's native OTLP ingestion endpoint
- **All metric types**: Supports counters, gauges, and histograms
- **Smart bucketing**: Histogram buckets auto-selected based on metric name (duration, tokens, generic)
- **Label preservation**: Metric labels exported as OTLP attributes

### Logs

- **Loki-native**: Uses Loki's JSON push API for log ingestion
- **Stream grouping**: Logs grouped by low-cardinality labels (level, entity type, environment)
- **Trace correlation**: `traceId` and `spanId` included in log lines for Tempo correlation
- **Structured data**: Metadata and structured data searchable via LogQL

### Batching

- Configurable batch size and flush interval per exporter instance
- Automatic periodic flush with `unref`'d timer (won't keep process alive)
- Re-buffering on transient failures with bounded growth cap (5x batch size)
- `flush()` method for serverless environments (call before function termination)

## License

Apache-2.0
