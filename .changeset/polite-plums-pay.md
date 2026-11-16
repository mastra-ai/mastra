---
'@mastra/core': patch
---

Added `KnowledgeInvalidCursorError`, thrown when a Knowledge list call gets a malformed cursor. The in-memory store now throws it instead of a `RangeError`.
