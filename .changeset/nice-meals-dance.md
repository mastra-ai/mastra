---
'@mastra/core': patch
---

Fixed `run.timeTravel()` on the evented workflow engine losing the workflow state that earlier steps set with `setState()`. The replayed step, the steps after it and the run's final state now see the state the earlier steps saved instead of going back to `initialState`, matching the default engine. Fixes [#30022](https://github.com/mastra-ai/mastra/issues/30022).
