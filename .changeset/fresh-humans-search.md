---
'@mastra/otel-exporter': minor
'@mastra/braintrust': minor
'@mastra/langsmith': minor
'@mastra/langfuse': minor
'@mastra/posthog': minor
'@mastra/observability': minor
'@mastra/core': minor
---

Added `TrackingExporter` base class with improved handling for:

- **Out-of-order span processing**: Spans that arrive before their parents are now queued and processed once dependencies are available
- **Delayed cleanup**: Trace data is retained briefly after spans end to handle late-arriving updates
- **Memory management**: Configurable limits on pending and total traces to prevent memory leaks

New configuration options on `TrackingExporterConfig`:

- `earlyQueueMaxAttempts` - Max retry attempts for queued events (default: 5)
- `earlyQueueTTLMs` - TTL for queued events in ms (default: 30000)
- `traceCleanupDelayMs` - Delay before cleaning up completed traces (default: 30000)
- `maxPendingCleanupTraces` - Soft cap on traces awaiting cleanup (default: 100)
- `maxTotalTraces` - Hard cap on total traces (default: 500)

Updated @mastra/braintrust, @mastra/langfuse, @mastra/langsmith, @mastra/posthog to use the new TrackingExporter
