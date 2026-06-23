---
'@mastra/core': minor
'@mastra/evals': patch
---

Added multi-turn support to `runEvals`. Data items can now include an `inputs: string[]` array — each entry is sent sequentially to the agent on the same thread, and scorers see the accumulated output from all turns. This enables testing conversation flows where behavior emerges across multiple interactions (memory recall, context retention, multi-step workflows).
