---
'@mastra/core': patch
---

Fixed structured output results and validation errors arriving after the finish event, so idle-thread subscribers receive them before the run ends. Runs that finish with an error no longer publish a final structured result or fallback value.

Fixed finish callbacks for streams that emit an error before finish, including non-structured runs. Previously accessed result promises still reject, but no longer interrupt stream completion or prevent `onFinish` and final cleanup from running. `onFinish.finishReason` now reports `'error'` for failed runs.
