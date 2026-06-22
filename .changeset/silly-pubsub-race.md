---
'@mastra/google-cloud-pubsub': patch
---

Fixed a startup race where concurrent subscribers to the same ungrouped topic could fail to attach. When a producer's `agent.stream()` and a consumer's `agent.observe()` subscribe to a fresh run topic within Google Cloud Pub/Sub's subscription-creation window, both raced to create the same subscription. The loser received an `ALREADY_EXISTS` error and, for ungrouped topics, fell through and threw `Failed to subscribe to topic`, killing the observe attach. Concurrent `init()` calls are now coalesced into a single create attempt, and an `ALREADY_EXISTS` result attaches to the existing subscription regardless of whether a group is set.
