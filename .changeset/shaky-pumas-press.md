---
'@mastra/core': patch
---

Fixed restarted workflows losing state changes made inside a nested workflow. When a run restarted after a crash while a nested workflow was still running, the nested workflow finished but its `setState` updates never reached the parent, so later steps saw the old state. The nested workflow's final state now carries back to the parent, as it already did for `start()` and `resume()`. `run.restart()` also accepts `outputOptions` to include the final state in its result.
