---
'@mastra/otel-exporter': minor
---

Added a `resourceSchemaUrl` option to `OtelExporter`. You can now declare which OpenTelemetry semantic conventions version your traces and logs follow, for backends that read attributes by version. Nothing is declared unless you set it.

```typescript
new OtelExporter({
  provider: { custom: { endpoint: 'https://collector.example.com' } },
  resourceSchemaUrl: 'https://opentelemetry.io/schemas/1.40.0',
});
```
