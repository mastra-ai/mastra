---
'@mastra/core': patch
---

Fix evented durable-agent runs stranding forever on distributed pubsub backends (Redis Streams, etc.): the `mastra.pubsub` proxy tagged the evented loop's `workflows`/`workflows-finish` events `localOnly` because the loop workflow is registered in the internal-workflow registry. Internal workflows can now be registered as `distributed`, which exempts their events from `localOnly` tagging so a remote orchestration worker can consume them.
