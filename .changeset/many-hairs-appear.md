---
'@mastra/core': minor
---

Added `tracingOptions.nestUnderParent` to attach a run as a child of an earlier run in the same trace, for example an LLM judge under the run it scores. The trace then keeps the name, input, output, and tags of the run that started it. The new `nestUnderRun()` helper builds these options from the earlier run's result.

```ts
import { nestUnderRun } from '@mastra/core/observability';

const turn = await assistant.generate('When does my order ship?');

await judge.generate('Grade this answer', {
  tracingOptions: nestUnderRun(turn),
  // same as: { traceId: turn.traceId, parentSpanId: turn.spanId, nestUnderParent: true }
});
```

Runs that pass `parentSpanId` without the new option behave as before.
