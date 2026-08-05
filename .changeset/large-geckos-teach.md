---
'@mastra/otel-exporter': patch
---

Updated the bundled OpenTelemetry dependencies so `@opentelemetry/core` resolves to a patched version (2.8.0 or later), removing exposure to the unbounded W3C baggage allocation issue where inbound `baggage` headers were parsed without size limits.

Stable OpenTelemetry SDK packages moved from `^2.7.1` to `^2.8.0` and the OTLP exporter/logs packages moved from `^0.218.0` to `^0.219.0`. No code changes are required.
