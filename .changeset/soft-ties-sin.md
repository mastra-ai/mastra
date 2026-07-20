---
'@mastra/core': patch
---

Fixed durable agents to pass the current execution actor to tools, preventing resumed runs from reusing stale trusted actor state.
