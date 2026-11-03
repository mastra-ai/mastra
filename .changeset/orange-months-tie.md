---
'@mastra/core': patch
---

Fixed tracing for durable agent runs that are resumed or recovered in another process. The resumed execution now records its own `AGENT_RUN` and `MODEL_GENERATION` span pair under the suspended one, in the same trace, and ends it once with its own outcome. The suspended pair keeps its `suspend` outcome instead of being ended a second time, and a forced recovery no longer leaves the recovered pair open. Until trace-level outcome selection lands, the trace list shows `suspend` for a resumed run; the resumed execution's outcome is on the nested span. On the default and evented engines, a run the sampler declined stays unrecorded through resume and recovery: no span of any type and no score is exported for it.
