---
'@mastra/core': patch
---

Fixed two workflow delivery bugs on push-only pubsubs such as `UnixSocketPubSub`.

- Subscribing to a topic right after its last listener unsubscribed no longer loses the subscription. Before, the new listener waited forever for events (for example, a run's finish event).
- Workflow events are now handled by one process instead of every process sharing the pubsub, matching how the Redis orchestration worker already behaves. Before, each process ran the same step.
