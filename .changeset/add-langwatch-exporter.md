---
"@mastra/langwatch": major
---

Initial release of @mastra/langwatch observability exporter.

Sends traces to LangWatch via OTLP/HTTP (protobuf) with automatic Bearer token authentication.

Features:
- Zero-config setup via `LANGWATCH_API_KEY` environment variable
- Custom endpoint support via `LANGWATCH_ENDPOINT` for self-hosted instances
- Extends `OtelExporter` for standard OpenTelemetry trace formatting
- Automatic disable with warning when API key is missing
