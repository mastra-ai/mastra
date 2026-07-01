---
'@mastra/core': patch
---

Fixed replay ordering on pull-mode transports (e.g. Redis Streams): history events are now delivered before live events, offsets are enforced on the live path, suppressed duplicates are acknowledged so persistent transports stop redelivering them, and ack/nack handles are preserved for buffered events.
