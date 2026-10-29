---
'@mastra/otel-exporter': minor
---

Fixed HTTP trace exports to custom endpoint paths such as `/api/otel/traces`. Query parameters are preserved, and log exports use the corresponding `/logs` path when the endpoint ends in `/traces` or `/logs`.

Added opt-in `metadataMapping` to copy selected metadata into top-level span attributes. Existing exports remain unchanged without a mapping:

```ts
new OtelExporter({
  provider: { custom: { endpoint: 'https://collector.example.com/api/otel/traces' } },
  metadataMapping: { userId: 'user.id', tenantId: 'tenant.id' },
});
```

Mapped values are strings; objects and arrays are JSON-encoded. Namespaced `mastra.metadata.*` attributes are retained.
