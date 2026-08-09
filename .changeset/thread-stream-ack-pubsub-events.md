---
'@mastra/core': patch
---

Acknowledge pubsub deliveries so persistent backends stop accumulating pending entries. Every subscriber that inspects events now acks them — including events it filters out — and nacks when processing throws: the agent thread-stream subscriber, the remote-run waiter (which also waits for the terminal event's ack before unsubscribing), workflow watchers on both `workflow.events.v2.*` and the shared `nested-watch` topic, durable-agent abort listeners, and user topic listeners registered through `addTopicListener` or the `events` config. `EventCallback` may now return a promise, and the in-process caching and event-emitter transports honor it.
