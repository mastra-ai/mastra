---
'@mastra/otel-bridge': patch
---

Fixed OtelBridge returning invalid all-zero span IDs when no TracerProvider is registered, which caused all spans to share the same identifier — silently corrupting storage (upsert collisions in postgres) and breaking OTEL export. The bridge now validates the OTEL span context and gracefully falls back to Mastra's own unique ID generation when the context is invalid.
