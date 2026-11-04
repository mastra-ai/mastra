---
'@mastra/core': patch
---

Fixed `agent.stream()` skipping `onFinish` when an output processor aborts the stream with a tripwire. `onFinish` now runs once with `finishReason: 'other'` and the tripwire details, so run spans close and finish hooks see the blocked run.
