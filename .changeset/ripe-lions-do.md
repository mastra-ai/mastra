---
'@mastra/otel-exporter': patch
---

Fixed `@mastra/otel-exporter` 1.5.0 exporting no traces or logs at all after a plain npm install. The OTLP exporter packages it depends on had moved to the OpenTelemetry SDK 3 line, failed to load next to its SDK 2 dependencies, and the exporter logged "exporter is not installed" and disabled export. They are back on the SDK 2 line, and spans are exported again.
