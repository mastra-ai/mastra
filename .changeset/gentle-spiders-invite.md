---
'@mastra/core': minor
---

Added `hookDurationMs` to output stream processor spans. It is the time spent inside `processOutputStream`, summed across all chunks. Fixes https://github.com/mastra-ai/mastra/issues/22343

Read it from the span attributes in any exporter:

```ts
import type { ObservabilityExporter, ExportedSpan } from '@mastra/core/observability';

const exporter: ObservabilityExporter = {
  name: 'processor-cost',
  async exportSpan(span: ExportedSpan) {
    if (span.entityType === 'output_processor') {
      console.log(span.name, span.attributes?.hookDurationMs);
    }
  },
};
```
