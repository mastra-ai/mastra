---
'@mastra/langfuse': patch
---

Fixed application version mapping on Langfuse traces and observations, and allowed overriding OpenTelemetry resource attributes. For example, with Langfuse credentials set in the environment:

```ts
import { LangfuseExporter } from '@mastra/langfuse';

const exporter = new LangfuseExporter({
  resourceAttributes: { 'service.version': '2.3.1' },
});
```
