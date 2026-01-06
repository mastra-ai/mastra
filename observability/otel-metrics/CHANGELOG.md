# @mastra/otel-metrics

## 1.0.0-beta.1

### Features

- Initial release of OpenTelemetry metrics collector for Mastra
- Implements `BaseMetricsCollector` from `@mastra/core`
- Uses OpenTelemetry Metrics API for universal backend compatibility
- Supports all Mastra metric types:
  - Agent runs, errors, and duration
  - Tool calls and duration
  - Model calls, tokens, and duration
  - HTTP requests and duration
  - Agentic metrics (guardrails, human interventions, goals, backtracks)
- Works with any OTEL MeterProvider and exporter (OTLP, Prometheus, etc.)
- Configurable metric prefix, meter name, and histogram buckets
