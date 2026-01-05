# @mastra/prometheus

## 1.0.0-beta.1

### Minor Changes

- Initial release of `@mastra/prometheus` package
- Implements `BaseMetricsCollector` from `@mastra/core` for Prometheus
- Exports all agentic metrics in Prometheus format
- Pre-registers core Mastra metrics with proper types and descriptions
- Supports custom metric prefix, histogram buckets, and registry
- Includes methods for exposing metrics endpoint (`getMetrics()`, `getContentType()`)
