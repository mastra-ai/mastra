---
'@mastra/core': patch
---

Fixed processors returning `{ tools: {}, toolChoice: 'none' }` being ignored. Previously, when a processor returned empty tools with an explicit `toolChoice: 'none'` to prevent tool calls, the toolChoice was discarded and defaulted to 'auto'. This fix preserves the explicit 'none' value, enabling patterns like ensuring a final text response when `maxSteps` is reached.
