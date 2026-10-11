---
'@mastra/core': patch
---

Fixed agent steps that start directly with a tool call being merged into the previous step in the conversation history sent to the model. Calls that ran one after another, where the second used the first's result, no longer look like parallel calls. Parallel tool calls within a single step still stay together.
