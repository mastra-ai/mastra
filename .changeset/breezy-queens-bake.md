---
'@mastra/observability': minor
---

Added CloudExporter support for Mastra Observability logs, metrics, scores, and feedback.

CloudExporter now batches and uploads all Mastra Observability signals to Mastra Cloud, not just tracing spans. Existing Cloud setups continue to work for traces with a small environment variable change, and the same exporter will now also publish structured logs, auto-extracted metrics, scores, and feedback records.

If you customize the Cloud ingest URL, pass a base endpoint such as `https://collector.example.com` and let the exporter derive the standard publish paths automatically.

```ts
import { CloudExporter, Observability } from '@mastra/observability';

const observability = new Observability({
  configs: {
    default: {
      serviceName: 'my-app',
      exporters: [
        new CloudExporter({
          endpoint: 'https://collector.example.com',
        }),
      ],
    },
  },
});

// Traces, logs, metrics, scores, and feedback now all publish through CloudExporter.
```
