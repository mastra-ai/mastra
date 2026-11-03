---
'@mastra/core': patch
---

Fixed request context writes made through a durable processor forEach callback. Resumed evented runs now pass their execution span to remote scorers, preserving the sampling decision and score attribution across workers.
