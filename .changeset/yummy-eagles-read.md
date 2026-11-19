---
'@mastra/core': patch
---

Fixed durable and evented agent steps running in every worker process when a store with workflow step guards (such as Postgres) is used with a pubsub that sends each event to all processes, such as `UnixSocketPubSub`. Tools ran more than once, the model was called several times for one step, and runs could stop after their first step. Each step now runs only in the process that owns the run, unless the pubsub hands each event to a single worker (for example Redis Streams), where another worker can still take over a step from a worker that stopped.
