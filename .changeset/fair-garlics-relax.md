---
'@mastra/core': patch
---

Fixed agent.stream() so the returned spanId matches the top-level agent run span instead of the nested model span.
