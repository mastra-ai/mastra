---
'@mastra/core': patch
---

Evented workflows and agents no longer drop a step event that the broker delivers again within 30 seconds. The step's code can run again when that happens.

With Postgres or libSQL storage, only one result is saved for each step. A `foreach` item can still run and save again, and so can an evented agent's tool call, which runs as a `foreach` item. With `storageVersion: 2`, a copy that arrives after the step finished can also run again. Other storage adapters save the result of every copy.

On a pubsub that delivers each event to every subscriber, such as a unix socket pubsub shared by several processes, every process now runs a delivered step. Running evented workflows and agents on several processes with such a pubsub was already unsupported.

Make steps and tools safe to run more than once. See [restarting active workflow runs](https://mastra.ai/docs/workflows/overview#restarting-active-workflow-runs) and [make tools safe to repeat](https://mastra.ai/docs/harness/durable-agents#make-tools-safe-to-repeat).
