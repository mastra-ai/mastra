---
'@mastra/core': patch
---

Fixed multi-instance thread subscriptions to replay completed streams consistently, reject stale active runs using lease ownership, and route remote abort requests to the owning process.
