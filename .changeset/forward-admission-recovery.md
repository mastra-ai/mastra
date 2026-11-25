---
'@mastra/core': patch
---

Fixed a forwarded user message running twice on multi-process deployments. When the run it was forwarded to finished and released its thread lease while the forwarding process was still behind on the thread stream, lease recovery could queue the message again even though it had already run. The forwarding process now reads the thread back to its own marker, and checks the lease once more, before it requeues. On brokers that deliver a topic's messages in order, such as Redis Streams, lease recovery no longer queues a message again when the forwarder reads its admission before that marker. It can still be queued twice when the admission lands after the marker: a run that regains the lease, admits the message, and releases the lease again between two of the forwarder's lease checks, or an admission publish that is still being retried when its run releases the lease. A forwarder on an older version keeps the previous behavior until it upgrades. Refs #30792.

Retried announcements and admissions no longer show a message as "sending" after its run has ended. The fix keeps a retried append ahead of anything the same agent thread runtime later publishes to that thread through the same pubsub. It does not cover publishes from other runtimes, including other runtimes in the same process.
