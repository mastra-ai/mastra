---
'@mastra/otel-bridge': minor
---

Added log forwarding to `@mastra/otel-bridge`. The bridge now also subscribes to Mastra log events and forwards them to the globally-registered OpenTelemetry `LoggerProvider`, alongside the spans it already creates.

Logs that originate inside a Mastra span are emitted under that span's OTEL context, so backends like Datadog, Grafana, and Honeycomb correlate them with the surrounding trace automatically. Logs without trace context fall through to the currently active OTEL context.

To wire up logs alongside traces, register a `logRecordProcessor` on `NodeSDK`:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

const sdk = new NodeSDK({
  // ...trace config as usual
  logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter()),
});
```

If no `LoggerProvider` is registered, log emission is a silent no-op — traces continue to work as configured.
