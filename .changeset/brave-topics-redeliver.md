---
'@mastra/google-cloud-pubsub': patch
---

`GoogleCloudPubSub` now reports `redeliversUnacked` as `true`: a message a dead subscriber held is delivered again once its ack deadline passes. Workflow recovery then leaves evented runs to Pub/Sub instead of restarting them on every booting instance (#28712).
