---
'@mastra/redis-streams': patch
---

Drain already-issued read and reclaim batches before unsubscribe finishes, and keep concurrent shutdown from closing the writer before dispatch completes. Application callbacks remain non-blocking and retain responsibility for ACK/NACK.
