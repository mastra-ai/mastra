---
'@mastra/observability': minor
---

Added CloudExporter support for Mastra Observability logs, metrics, scores, and feedback.

CloudExporter now batches and uploads all Mastra Observability signals to Mastra Cloud, not just tracing spans.

This includes a breaking change to the CloudExporter endpoint format. We now pass a base endpoint URL and let let the exporter derive the standard publish paths automatically.

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

After updating the exporter endpoint config, the exporter will continue to work for traces, and the same exporter will now also publish structured logs, auto-extracted metrics, scores, and feedback records.
```
