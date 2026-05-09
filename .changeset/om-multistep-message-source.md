---
"@mastra/core": patch
---

Fixed assistant message tracking when ObservationalMemory clears step-1 output to memory and step-2 text merges into the same assistant message, so merged text is not lost on the next response clear.
