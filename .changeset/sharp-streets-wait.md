---
'@mastra/core': minor
---

Added typed descriptions for processor span payloads and pipeline attributes. Processor spans now record their exact pipeline phase, so consumers can narrow supported payloads without guessing their shape.

```ts
import { describeSpanInput } from '@mastra/core/observability';

const input = describeSpanInput(span);
if (input?.type === 'processor' && input.value.phase === 'outputStream') {
  input.value.data.totalChunks; // number
}
```

Added `describeProcessorPipeline` for executor, pipeline position, hook duration, mutations, and tripwire details. Unknown attributes remain separate from the known fields. Unsupported or malformed data falls back to JSON, and existing processor span producers remain compatible.

Fixed missing message-list mutation logs in workflow processor executions.
