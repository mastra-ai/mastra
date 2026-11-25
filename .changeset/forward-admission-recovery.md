---
'@mastra/core': patch
---

Fixed a forwarded user message running twice on multi-process deployments. When the run it was forwarded to finished and released its thread lease while the forwarding process was still behind on the thread stream, lease recovery could queue the message again even though it had already run. The forwarding process now reads the thread back to its own marker, and checks the lease once more, before it requeues. On brokers that deliver a topic's messages in order, such as Redis Streams, a message runs once when its admission reached the thread stream before that marker. It can still run twice when the admission lands after the marker: a run that regains the lease, admits the message, and releases the lease again between two of the forwarder's lease checks, or an admission publish that is still being retried when its run releases the lease. A forwarder on an older version keeps the previous behavior until it upgrades. Refs #30792.

A retried append of a pending announcement or an admission is also kept ahead of anything the same process publishes to that thread afterwards, so it can no longer land after its run's end and trim and replay as "sending". This ordering does not cover publishes from other processes.
