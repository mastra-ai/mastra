---
'@mastra/core': patch
---

Fixed agent memory so that calls now fail immediately when the given thread belongs to a different resource. Previously agent.stream() and agent.generate() would silently run the model and drop the turn instead of reporting the ownership mismatch (#21641).
