---
'@mastra/otel-bridge': patch
---

Fixed `OtelBridge` silently exporting nothing when no OpenTelemetry tracer provider is available. The bridge now logs one clear warning that explains how to register a tracer provider or pass one with `new OtelBridge({ tracerProvider })`, and links to the setup docs. It no longer logs a warning for every span. Mastra spans also no longer reuse an outer span's ID when that outer span comes from a tracer provider that isn't registered. Fixes [#24950](https://github.com/mastra-ai/mastra/issues/24950).
