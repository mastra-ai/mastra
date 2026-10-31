---
'@mastra/core': patch
---

`validateStepRequestContext` now accepts any object with `id` and `requestContextSchema`, so callers no longer need a full `Step`.
