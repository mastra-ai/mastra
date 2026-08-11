---
'@mastra/factory': patch
---

Fixed new Factory sessions stalling behind deep background decision queues. The dispatcher now prioritizes pending session starts over deferred decisions when dispatch capacity is available.
