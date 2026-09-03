---
'@mastra/core': minor
---

Traces now show Mastra's built-in add-ons as the subsystem they came from, instead of anonymous processor runs.

Skills, workspace instructions, observational memory and agent state signals all run on the processor pipeline, but you configure `skills`, `workspace`, `memory` and `signals` — not processors. Their spans were named after a pipeline phase you never chose:

| Was                                                      | Now                            |
| -------------------------------------------------------- | ------------------------------ |
| `input step processor: skills-processor`                 | `skill:inject`                 |
| `input step processor: workspace-instructions-processor` | `workspace:mount:instructions` |
| `input step processor: observational-memory`             | `memory: recall`               |

**New span types**

- `SKILL_ACTION` covers the whole skill lifecycle — resolve, inject, activate, search, read. `SKILL_RESOLUTION` is deprecated and no longer emitted.
- `AGENT_SIGNAL` records each state signal emission as a point-in-time event. A turn where the lane computes no change records nothing.

**Tracing your own processors**

Any processor can declare how it is traced, and one that declares nothing is unchanged:

```ts
import { SpanType } from '@mastra/core/observability';
import type { Processor, ProcessorSpanPhase } from '@mastra/core/processors';

class MyProcessor implements Processor<'my-processor'> {
  readonly id = 'my-processor' as const;
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = (phase: ProcessorSpanPhase) => `memory: ${phase === 'inputStep' ? 'recall' : 'save'}`;
  readonly spanAttributes = { operationType: 'recall' } as const;
}
```

**Fixes**

- The skills processor reports `skillCount` on every run. A skills path that resolved to nothing previously produced no span at all; it now shows as `skillCount: 0`.
- `computeStateSignal` implementations receive the `tracingContext` their argument type always advertised but never passed.
