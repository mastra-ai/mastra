---
'@mastra/core': minor
'@mastra/observability': patch
---

Traces now label internally-derived processors with the Mastra subsystem they came from, instead of showing them as anonymous processor runs.

A processor can declare the span type it should be traced as:

```ts
class SkillsProcessor implements Processor<'skills-processor'> {
  readonly spanType = SpanType.SKILL_ACTION;
  readonly spanName = 'skill:inject';
}
```

Processors that do not declare one are unchanged and still emit `PROCESSOR_RUN`.

**Skill spans**

Added a `SKILL_ACTION` span type covering the whole skill lifecycle, discriminated by `operation`: `resolve`, `inject`, `activate`, `search`, `read`. The skill tools previously traced as workspace actions, which only made sense while skills lived on a workspace — agent-level skills have no workspace. `SKILL_RESOLUTION` is deprecated and no longer emitted; it remains defined so stored traces keep resolving.

The skills processor now reports `skillCount` on every run, including for statically configured skills. Previously a skill span was only emitted for dynamic skills resolvers, so a skills path that resolved to nothing produced no span at all and was invisible in traces. A `skillCount: 0` now makes that misconfiguration obvious.

**Pipeline data is preserved**

Spans keep their `entityType` and their processor pipeline attributes (position in the chain, message-list mutations, tripwire details) whichever span type they carry, so nothing is lost by retyping. Processor duration metrics are now keyed off the entity type rather than the span type, so `mastra_processor_duration_ms` stays complete across retyped processors.
