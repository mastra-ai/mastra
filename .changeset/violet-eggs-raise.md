---
'@mastra/memory': patch
---

Improved observational memory near the message token threshold by adding runtime backpressure, more aggressive near-threshold buffering, and pre-sealing of eligible messages before threshold handling. Buffered activation now waits only when it still looks necessary, reducing collapse-prone threshold crossings.
