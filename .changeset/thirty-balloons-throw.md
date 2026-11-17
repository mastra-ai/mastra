---
'@mastra/core': patch
---

Fixed evented workflows storing the wrong workflow state after parallel branches changed a state that has a top-level `output` array. The stored state kept items from the old array, so a run restarted after a crash continued with the wrong state.
