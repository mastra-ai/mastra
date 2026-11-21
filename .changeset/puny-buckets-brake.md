---
'@mastra/core': patch
---

Fixed durable thread streams replaying a queued or steered user message as still "sending" after a reconnect. On retaining transports such as Redis Streams and Valkey Streams, the pending announcement now leaves the thread stream when the run it waited on completes, so later `subscribeToThread()` calls no longer show it. Fixes #30792.

Also fixed a forwarded user message running twice on multi-process deployments. When the run it was forwarded to finished and released its thread lease while the forwarding process was still behind on the thread stream, lease recovery queued the message again even though it had already run. The forwarding process now reads the thread back to its own marker before it requeues, so a message the owner admitted is settled first.
