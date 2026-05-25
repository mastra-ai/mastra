---
'@mastra/memory': patch
---

Reduced transient memory retention in Observational Memory by releasing heavy prompt/context references after each agent turn ends. ObservationTurn and ObservationStep now dispose their _context, systemMessage, writer, requestContext, observabilityContext, and actorModelContext fields when the turn finishes. The ObservationalMemoryProcessor also clears shared processor state keys (__omTurn, __omActorModelContext, __omObservabilityContext) after processOutputResult, preventing split input/output processor instances from retaining large memory strings between turns.
