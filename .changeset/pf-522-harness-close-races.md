---
"@mastra/core": patch
---

Fixed race conditions that could cause errors during shutdown when sessions were still active.

Improved reliability when creating child sessions while parent sessions are closing.
