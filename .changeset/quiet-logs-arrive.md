---
'@mastra/otel-bridge': patch
---

Fixed Mastra logs being dropped by `OtelBridge` in apps on OpenTelemetry JS SDK 3. The bridge now finds a `LoggerProvider` registered through `@opentelemetry/api` (SDK 3) as well as one registered through `@opentelemetry/api-logs` (SDK 2), including when it is registered after the bridge is created. When no provider is registered, the bridge now says so once at debug level. Fixes [#29695](https://github.com/mastra-ai/mastra/issues/29695).
