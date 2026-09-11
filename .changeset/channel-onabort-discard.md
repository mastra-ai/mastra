---
'@mastra/core': patch
---

Channel adapters can now discard the agent's buffered reply when a run is aborted. A new `onAbort: 'flush' | 'discard'` option on the adapter config controls what the static (non-streaming) driver does with not-yet-posted text on an `abort` chunk: `'flush'` (the default) posts the partial reply as before, and `'discard'` drops it so nothing is posted. This supports human-takeover flows on non-streaming platforms, where an in-flight agent reply should not appear as a truncated message beside the operator's own reply. Fixes #23640.
