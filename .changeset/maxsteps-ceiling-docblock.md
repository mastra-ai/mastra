---
'@mastra/core': patch
---

Documentation: on the plain agent loop `maxSteps` is a hard ceiling. A failing `isTaskComplete` scorer can no longer carry a run past its step budget, which is how the durable loop already behaved. This corrects a docblock that claimed the opposite.
