---
'@mastra/core': minor
---

Added execution outcomes and typed stop-reason details to agent, model, tool, and workflow traces. Traces distinguish failures, cancellations, limits, guardrail blocks, and observer interruptions; TripWire errors now serialize with the name `TripWire` so they can be identified across workers.

Custom spans can record an outcome with a compact stop-reason context:

```ts
import { SpanType, type ObservabilityInstance } from '@mastra/core/observability';

function recordGuardrailBlock(observability: ObservabilityInstance, processorId: string) {
  const span = observability.startSpan({ name: 'policy check', type: SpanType.GENERIC });
  span.end({ outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { processorId } });
}
```
