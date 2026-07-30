---
'@mastra/core': minor
---

Add optional `idleTimeoutMs` and `isAlive` options to `DurableAgent.observe()`. A durable run whose driving process crashed stops emitting chunks but never publishes a terminal event, so a reconnecting `observe()` previously hung forever on a producerless pubsub topic. With `idleTimeoutMs` set, the stream terminates after that much silence; an optional `isAlive` probe (e.g. a run-liveness heartbeat) is consulted first so a legitimately-idle-but-live run (a long tool call, or a suspended HITL gate) keeps waiting instead of being closed. Fully backward-compatible: absent, behavior is unchanged.
