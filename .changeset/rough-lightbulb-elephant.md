---
'@mastra/otel-exporter': patch
---

Add `resourceAttributes` to `OtelExporterConfig` so that attributes like `deployment.environment` can be set in the new OpenTelemetry exporter.
