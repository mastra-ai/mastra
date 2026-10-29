---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
---

Fixed upgraded D1 and Durable Object stores deleting finished background tasks early. When a new nullable column such as `expiresAt` was added to an existing table, older rows got a 1970 placeholder value instead of no value. Background task cleanup read that as an expiry date that had long passed, so it deleted finished tasks before the usual retention period ended. New nullable columns now start empty.
