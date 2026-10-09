---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable agents, including Inngest agents, ignoring an `abort()` from an output processor's `processOutputResult`. The run now reports the tripwire with `finishReason: 'other'`, as a regular `Agent` does. The rejected answer is no longer saved to memory.
