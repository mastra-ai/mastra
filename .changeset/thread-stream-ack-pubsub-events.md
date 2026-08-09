---
'@mastra/core': patch
---

Acknowledge pubsub deliveries so persistent backends stop accumulating pending entries. Every fan-out subscribe creates a private consumer group, and Redis keeps each delivered entry pending until it is acked, so subscribers that never acknowledged grew an unbounded pending list for as long as they stayed attached.

The following subscribers now ack every event they inspect (including ones they filter out) and nack when processing throws:

- the agent thread-stream subscriber and the cross-agent remote-run waiter, which also waits for the terminal event's ack before unsubscribing
- workflow run watchers, including the shared `nested-watch` topic
- durable agent abort-request listeners
- user-defined topic listeners registered through `events` or `addTopicListener`

`events` listeners are typed as receiving only the event; acknowledgement is handled for them.
