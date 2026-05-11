---
'@mastra/otel-exporter': minor
---

Added log export to `@mastra/otel-exporter`. Logs emitted on the Mastra observability bus are now forwarded to the configured OTLP endpoint alongside traces, using the same provider configuration.

```ts
import { OtelExporter } from '@mastra/otel-exporter';

new OtelExporter({
  provider: {
    custom: { endpoint: 'http://localhost:4318', protocol: 'http/json' },
  },
  // signals.logs defaults to true; set to false to disable.
  signals: { traces: true, logs: true },
});
```

Requires the matching OTLP log exporter package to be installed (e.g. `@opentelemetry/exporter-logs-otlp-http` for HTTP/JSON, or `-proto` / `-grpc` variants).

**Trace correlation:** Logs that carry `traceId` and `spanId` are attached to the OTEL log record's native trace context, so backends like Datadog, Grafana, and Honeycomb auto-correlate logs to traces.

**Other improvements:**

- Trace and log endpoints are always normalized to a single signal-path suffix, so `http://host:4318/`, `http://host:4318`, and `http://host:4318/v1/traces/` all produce well-formed URLs instead of malformed variants like `//v1/logs`.
- Calling `flush()` or `shutdown()` immediately after init no longer drops telemetry — teardown waits for setup to finish before draining providers.
- Debug log output no longer exposes credential fragments. Provider header values are fully redacted instead of printing prefix/suffix slices.
- When a dynamically-loaded OTLP exporter package is installed but does not expose the expected named export, Mastra now disables that signal with a clear error message instead of failing later with an opaque "X is not a constructor" error.
