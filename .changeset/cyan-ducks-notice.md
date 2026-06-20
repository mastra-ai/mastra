---
'@mastra/google-cloud-pubsub': patch
---

Fixed a startup race in `@mastra/google-cloud-pubsub` when two clients subscribe to the same new topic at the same time. Both subscribers now attach successfully and reuse the same subscription, instead of one failing with "Failed to subscribe to topic".
