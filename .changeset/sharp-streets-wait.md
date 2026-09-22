---
'@mastra/core': minor
---

Added typed `input` and `output` payloads for `PROCESSOR_RUN` spans, so anything reading a trace can present what a processor received, changed, or blocked instead of interpreting raw JSON.

Processor spans now record which pipeline phase produced them, under `attributes.processorPhase`. This is the discriminant readers narrow on: `entityType` could not serve, because `llmRequest`/`llmResponse` share one entity type and `outputStep`/`requestError` share another. The recorded phase also keeps the two output hooks apart, which the declaration phase collapses into a single `'output'`.

```ts
import { describeSpanInput, describeProcessorPipeline } from '@mastra/core/observability';

const input = describeSpanInput(span);
if (input?.type === 'processor') {
  input.value.phase; // 'toolResult'
  input.value.phaseLabel; // 'Tool result'
  input.value.data; // typed for that phase
}

// Runner-owned attributes, separated from anything a processor set itself.
const pipeline = describeProcessorPipeline(span);
pipeline?.tripwireAbort?.reason; // 'Prompt injection detected'
pipeline?.rest; // only the attributes the description does not explain
```

**Fixed** message-list mutations were only recorded when processors ran on the legacy executor. Spans from the default workflow executor now carry `messageListMutations` too, so a processor's edits show up whichever executor ran it.

Spans stored before this release carry no phase and keep their previous untyped shape.
