---
'@mastra/core': patch
---

Evented workflows and agents no longer drop a step event that the broker delivers again within 30 seconds. The step's code can run again when that happens.

With Postgres or libSQL storage, only one result is saved for each step. A `foreach` item can still run and save again, and so can an evented agent's tool call, which runs as a `foreach` item. With `storageVersion: 2`, a copy that arrives after the step finished can also run again. Other storage adapters save the result of every copy. On an adapter without run-ownership support, a copy that arrives after the step finished also runs the step again.

Make steps and tools safe to run more than once. See [restarting active workflow runs](https://mastra.ai/docs/workflows/overview#restarting-active-workflow-runs) and [make tools safe to repeat](https://mastra.ai/docs/harness/durable-agents#make-tools-safe-to-repeat).
