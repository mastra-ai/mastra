---
'@mastra/core': patch
---

Fixed Unix socket pubsub clients hanging forever on startup when connecting to a broker from an older build that never acknowledges subscribe requests. Subscriptions now proceed best-effort after a configurable timeout (default 5 seconds, via the new membershipAckTimeoutMs option).
