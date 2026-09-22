---
'@mastra/core': minor
---

Added typed descriptions for processor span payloads and pipeline attributes. Processor spans now record their exact pipeline phase, so consumers can narrow supported payloads without guessing their shape.

```ts
import { describeSpanOutput } from '@mastra/core/observability';

const output = describeSpanOutput(span);
if (output?.type === 'processor' && output.value.phase === 'outputStream') {
  output.value.data.totalChunks; // number
}
```

Added `describeProcessorPipeline` for executor, pipeline position, hook duration, mutations, and tripwire details. Unknown attributes remain separate from the known fields, so no value is rendered twice. Spans recorded before the phase existed keep their untyped shape and fall back to JSON.

Fixed missing message-list mutation logs in workflow processor executions.
