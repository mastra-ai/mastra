---
'@mastra/core': minor
'@mastra/observability': patch
---

Traces now label internally-derived processors with the Mastra subsystem they came from, instead of showing them as anonymous processor runs.

A processor can declare the span type it should be traced as:

```ts
class SkillsProcessor implements Processor<'skills-processor'> {
  readonly spanType = SpanType.SKILL_RESOLUTION;
  readonly spanName = 'skills: inject catalog';
}
```

Processors that do not declare one are unchanged and still emit `PROCESSOR_RUN`.

**What you'll notice**

The skills processor now traces as a Skill span rather than an untyped processor entry, and reports `skillCount` on every run — including when skills are configured statically. Previously a skill span was only emitted for dynamic skills resolvers, so a skills path that resolved to nothing produced no span at all and was invisible in traces. A `skillCount: 0` now makes that misconfiguration obvious.

Spans keep their `entityType` and their processor pipeline attributes (position in the chain, message-list mutations, tripwire details) whichever span type they carry, so nothing is lost by retyping. Processor duration metrics are now keyed off the entity type rather than the span type, so `mastra_processor_duration_ms` stays complete across retyped processors.
