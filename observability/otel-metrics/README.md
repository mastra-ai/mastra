# @mastra/otel-metrics

OpenTelemetry metrics collector for Mastra observability. Export agentic metrics to any OTEL-compatible backend.

## Installation

```bash
npm install @mastra/otel-metrics @opentelemetry/api
```

For exporting metrics, you'll also need the OTEL SDK and an exporter:

```bash
# For OTLP export (Datadog, New Relic, Grafana Cloud, etc.)
npm install @opentelemetry/sdk-metrics @opentelemetry/exporter-metrics-otlp-http

# For Prometheus export
npm install @opentelemetry/sdk-metrics @opentelemetry/exporter-prometheus
```

## Usage

### Basic Setup with OTLP Export

```typescript
import { Mastra } from '@mastra/core';
import { OtelMetricsCollector } from '@mastra/otel-metrics';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { metrics } from '@opentelemetry/api';

// 1. Set up OTEL metrics SDK (typically in your instrumentation setup)
const meterProvider = new MeterProvider();
meterProvider.addMetricReader(
  new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'https://your-otlp-endpoint/v1/metrics',
    }),
    exportIntervalMillis: 60000, // Export every 60 seconds
  }),
);
metrics.setGlobalMeterProvider(meterProvider);

// 2. Create Mastra with OTEL metrics collector
const mastra = new Mastra({
  agents: { myAgent },
  metrics: new OtelMetricsCollector(),
});
```

### With Prometheus Export

```typescript
import { Mastra } from '@mastra/core';
import { OtelMetricsCollector } from '@mastra/otel-metrics';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { metrics } from '@opentelemetry/api';

// Set up Prometheus exporter (starts HTTP server on port 9464)
const prometheusExporter = new PrometheusExporter({
  port: 9464,
});

const meterProvider = new MeterProvider();
meterProvider.addMetricReader(prometheusExporter);
metrics.setGlobalMeterProvider(meterProvider);

// Create Mastra
const mastra = new Mastra({
  agents: { myAgent },
  metrics: new OtelMetricsCollector(),
});

// Metrics available at http://localhost:9464/metrics
```

### Configuration Options

```typescript
const collector = new OtelMetricsCollector({
  // Name of the meter (instrument scope)
  meterName: 'my-application',

  // Version of the meter
  meterVersion: '1.0.0',

  // Prefix for all metric names (default: 'mastra_')
  prefix: 'myapp_',

  // Custom histogram buckets for duration metrics (ms)
  durationBuckets: [10, 50, 100, 500, 1000, 5000],

  // Custom histogram buckets for token counts
  tokenBuckets: [100, 500, 1000, 5000, 10000],
});
```

## Metrics Exported

All standard Mastra metrics are exported with the configured prefix:

### Agent Metrics

- `{prefix}agent_runs_total` - Total agent runs
- `{prefix}agent_run_duration_ms` - Agent run duration histogram
- `{prefix}agent_errors_total` - Agent errors

### Tool Metrics

- `{prefix}tool_calls_total` - Total tool calls
- `{prefix}tool_call_duration_ms` - Tool call duration histogram
- `{prefix}tool_errors_total` - Tool errors

### Model/LLM Metrics

- `{prefix}model_calls_total` - Total model calls
- `{prefix}model_call_duration_ms` - Model call duration histogram
- `{prefix}model_input_tokens` - Input tokens histogram
- `{prefix}model_output_tokens` - Output tokens histogram

### HTTP Metrics

- `{prefix}http_requests_total` - Total HTTP requests
- `{prefix}http_request_duration_ms` - HTTP request duration histogram

### Agentic Metrics

- `{prefix}agent_guardrail_triggers_total` - Guardrail trigger count
- `{prefix}agent_human_approvals_requested_total` - Human intervention count
- `{prefix}agent_goal_completed_total` - Completed goals
- `{prefix}agent_goal_failed_total` - Failed goals
- `{prefix}agent_backtracks_total` - Agent backtracks/retries

## Integration with Existing OTEL Setup

If you already have OpenTelemetry configured in your application (e.g., for tracing), the `OtelMetricsCollector` will automatically use the global `MeterProvider`. Just ensure metrics are set up before creating the Mastra instance:

```typescript
// Your existing OTEL setup
import './instrumentation'; // Sets up MeterProvider

// Mastra will use the global MeterProvider
import { Mastra } from '@mastra/core';
import { OtelMetricsCollector } from '@mastra/otel-metrics';

const mastra = new Mastra({
  metrics: new OtelMetricsCollector(),
  // ...
});
```

## Combining with Mastra OTEL Tracing

For complete observability, combine with Mastra's OTEL tracing packages:

```typescript
import { Mastra } from '@mastra/core';
import { OtelMetricsCollector } from '@mastra/otel-metrics';
import { OtelBridge } from '@mastra/otel-bridge';

const mastra = new Mastra({
  agents: { myAgent },
  metrics: new OtelMetricsCollector(),
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge(),
      },
    },
  },
});
```

## License

Elastic-2.0
