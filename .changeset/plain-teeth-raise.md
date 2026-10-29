---
'@mastra/otel-exporter': minor
---

Added explicit `custom.endpoints.traces` and `custom.endpoints.logs` URLs, passed through without rewriting paths or query parameters. Omitted signals are not exported. Configure either `endpoint` or `endpoints`, never both; this is enforced in TypeScript and at runtime. The singular `endpoint` option retains its legacy behavior.

Custom OTLP providers without explicit endpoint configuration now read `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` automatically. Explicit endpoint configuration takes precedence over both variables.

Added opt-in `metadataMapping` to copy selected metadata into top-level span attributes. Existing exports remain unchanged without a mapping:

```ts
new OtelExporter({
  provider: {
    custom: {
      endpoints: {
        traces: 'https://collector.example.com/api/otel/traces',
        logs: 'https://collector.example.com/events',
      },
    },
  },
  metadataMapping: { userId: 'user.id', tenantId: 'tenant.id' },
});
```

Mapped values are strings; objects and arrays are JSON-encoded. Namespaced `mastra.metadata.*` attributes are retained.
