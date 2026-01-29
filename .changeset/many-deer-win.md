---
'@mastra/core': patch
---

Fixed agent network crashing with 'Invalid task input' error when routing agent returns malformed JSON for tool/workflow prompts. The error is now fed back to the routing agent, allowing it to retry with valid JSON on the next iteration.
