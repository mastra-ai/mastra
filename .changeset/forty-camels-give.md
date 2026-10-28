---
'@mastra/core': minor
---

Added execution outcomes and typed stop-reason details to agent, model, tool, and workflow traces. Traces distinguish failures, cancellations, limits, guardrail blocks, and observer interruptions; TripWire errors now serialize with the name `TripWire` so they can be identified across workers.

Exported spans now carry `outcome`, `stopReason`, and `stopReasonContext`, so exporters can tell why an execution ended:

```ts
import { TracingEventType, type TracingEvent } from '@mastra/core/observability';

function onTracingEvent(event: TracingEvent) {
  if (event.type !== TracingEventType.SPAN_ENDED) return;
  const { outcome, stopReason, stopReasonContext } = event.exportedSpan;
  if (outcome === 'blocked' && stopReason === 'guardrail') {
    console.log('Blocked by', stopReasonContext?.tripwire?.processorId);
  }
}
```
