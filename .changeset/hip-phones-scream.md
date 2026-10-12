---
'@mastra/core': minor
---

Added native span input and output preview formatters for ingestion. Trace query responses also accept an optional stored `outputPreview`.

```ts
import { buildSpanOutputPreview, SpanType } from '@mastra/core/observability';

buildSpanOutputPreview({ spanType: SpanType.MODEL_INFERENCE, output: { text: 'Answer' } });
// { value: 'Answer', truncated: false }
```
