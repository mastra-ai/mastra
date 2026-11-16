---
'@mastra/core': patch
---

Added `KnowledgeInvalidCursorError`, thrown when a Knowledge list call gets a cursor the store did not issue. The in-memory store now throws it instead of a `RangeError`.
