---
'@mastra/core': patch
---

Fixed durable agents (including Inngest agents) ignoring an `abort()` from an output processor's `processOutputResult`. The run now reports the tripwire with `finishReason: 'other'`, like a regular `Agent`, and the rejected answer is no longer saved to memory.
