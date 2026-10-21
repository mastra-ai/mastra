---
'@mastra/core': patch
---

Fixed `Agent.stream()` ending with a `finish` chunk (reason `stop`) when an output processor aborts in `processOutputResult`. The stream now ends with a `tripwire` chunk and `status` is `'tripwire'`, matching durable agents and other processor tripwires.
