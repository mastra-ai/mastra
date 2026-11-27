---
'@mastra/core': patch
'@mastra/redis-streams': patch
---

Route local evented workflow steps and scheduled fires to the Mastra instance that owns them when multiple instances share a pubsub. Broker-delivered work remains available to other workers. Local execution commands no longer appear on the raw adapter’s shared `workflows` topic; `Run.observeStream()` still reports run progress and results. Redis Streams registers the owner’s local subscription without creating a Redis stream or consumer group.
