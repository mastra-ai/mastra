---
'@mastra/observability': minor
---

Added an explicit opt-in to persist observability data to your own storage alongside Mastra Platform. Built-in storage exporters remain disabled on Platform by default. Local observability domains remain disabled with an initialization warning, even with the opt-in. Set `retainStorageExporterOnPlatform: true` on an observability config to retain them, including exporters registered later.

```ts
new Observability({
  configs: {
    production: {
      serviceName: 'my-service',
      retainStorageExporterOnPlatform: true,
      exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
    },
  },
});
```

Skipped storage exporters now log a warning explaining how to opt in.
