---
'@mastra/core': patch
---

Fixed agent thread streams and durable stream adapters leaving PubSub deliveries unacknowledged. Every delivered event is now acknowledged once handled, so persistent backends like Redis Streams or GCP Pub/Sub no longer accumulate pending messages on these subscriptions.
