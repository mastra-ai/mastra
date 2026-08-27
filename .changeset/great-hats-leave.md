---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/sentry': patch
'@mastra/memory': patch
---

Traces now label Mastra's built-in add-ons with the subsystem they came from, instead of showing them as anonymous processor runs.

Skills, workspace instructions, observational memory and agent state signals all run on the processor pipeline, but you configure `skills`, `workspace`, `memory` and `signals` — not processors. Their spans were named after a pipeline phase you never chose:

| Was                                                      | Now                                   |
| -------------------------------------------------------- | ------------------------------------- |
| `input step processor: skills-processor`                 | `skill:inject`                        |
| `input step processor: workspace-instructions-processor` | `workspace:mount:instructions`        |
| `input step processor: observational-memory`             | `memory: recall`                      |
| `output processor: observational-memory`                 | `memory: save`                        |
| `om.observer` / `om.reflector`                           | `memory: observe` / `memory: reflect` |

Processors keep their `entityType` and pipeline attributes whichever span type they carry, so a span still shows where in the chain it ran and what it changed on the message list.

**New span types**

- `SKILL_ACTION` covers the whole skill lifecycle — `resolve`, `inject`, `activate`, `search`, `read`. The skill tools previously traced as workspace actions, which only made sense while skills lived on a workspace; agent-level skills have no workspace. `SKILL_RESOLUTION` is deprecated and no longer emitted.
- `AGENT_SIGNAL` records each state signal emission as a point-in-time event rather than a duration, since computing it is already timed by the surrounding span. A turn where the lane computes no change records nothing.

**Fixes**

- The skills processor now reports `skillCount` on every run, including for statically configured skills. Previously a skill span was only emitted for dynamic skills resolvers, so a skills path that resolved to nothing produced no span at all. A `skillCount: 0` now makes that misconfiguration visible.
- `computeStateSignal` implementations receive a real `tracingContext`. It was always part of the argument type but was never passed.
- Observational memory's model passes expose `inputTokens`, `selectedModel` and `multiThread` as span attributes rather than untyped metadata. They also reported an output-step-processor entity type, which they are not, so `mastra_processor_duration_ms` was counting seconds-long model calls as processor overhead.
- Skill and workspace spans report as `ai.skill` and `ai.workspace` in Sentry rather than the generic `ai.span`, matching how memory spans already map to `ai.memory`.

**Writing your own**

Any processor can declare how it is traced, and one that declares nothing is unchanged:

```ts
class MyProcessor implements Processor<'my-processor'> {
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = (phase: ProcessorSpanPhase) => `memory: ${phase === 'inputStep' ? 'recall' : 'save'}`;
  readonly spanAttributes = { operationType: 'recall' } as const;
}
```
