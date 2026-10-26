---
'@mastra/server': patch
---

Fixed agent streams disconnecting during long tool calls or slow model responses by sending keepalive comments every 25 seconds. These comments don't change agent events or observation replay offsets.

Fixed durable agent HTTP observations closing during silent execution by checking producer liveness before releasing the subscription. Observers close after 10 consecutive inconclusive checks so missing run state or unavailable storage can't retain subscriptions indefinitely.
