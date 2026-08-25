---
'@mastra/memory': patch
---

Fix `continuationHints` being silently dropped when Observational Memory is configured through `Memory`. `Memory._initOMEngine` forwards the `observation`/`reflection` configs to the OM engine via explicit field lists, and `continuationHints` (added in #21302) was missing from both — so `continuationHints: { suggestedResponse: false }` had no effect unless `ObservationalMemory` was constructed directly. The Observer/Reflector prompts kept requesting the disabled sections and the injection gate kept admitting them.
