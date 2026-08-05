---
'@mastra/deepeval': minor
---

Added the `@mastra/deepeval` observability exporter to send Mastra traces to Confident AI for evaluation and monitoring.

Register it in your Mastra observability config:

```typescript
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { DeepEvalExporter } from '@mastra/deepeval';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      deepeval: {
        serviceName: 'my-service',
        exporters: [new DeepEvalExporter()],
      },
    },
  }),
});
```

Set `CONFIDENT_API_KEY` (and optionally `CONFIDENT_TRACE_ENVIRONMENT`) to send traces. Mastra spans map to Confident AI's `AGENT`, `LLM`, `TOOL`, `RETRIEVER`, and `CUSTOM` span types, with model, token counts, tool calls, and metric collections carried through.
