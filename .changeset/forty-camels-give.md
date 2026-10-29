---
'@mastra/core': minor
---

Added execution outcomes and typed stop-reason details to agent, model, tool, and workflow traces. Traces distinguish failures, cancellations, limits, guardrail blocks, and observer interruptions; TripWire errors now use the name `TripWire` instead of `Error`, including in string representations, stacks, and serialized errors, so they can be identified across workers.

Custom spans can record an outcome with a compact stop-reason context:

```ts
import { SpanType, type ObservabilityInstance } from '@mastra/core/observability';

function recordGuardrailBlock(observability: ObservabilityInstance, processorId: string) {
  const span = observability.startSpan({ name: 'policy check', type: SpanType.GENERIC });
  span.end({ outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { processorId } });
}
```

The public `outcome`, `stopReason`, and `stopReasonContext` fields now also allow `null`. Exporter and other consumer types must handle `null` alongside an absent value; arbitrary custom outcome strings and context objects remain supported. Workflow events and durable snapshots can now include tripwire details, including processor-supplied metadata.

Agent and generation spans also close when the internal workflow fails without a finish callback, while errors followed by a finish retain their final usage and output.
