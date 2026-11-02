---
'@mastra/temporal': patch
---

Fixed `run.start()` results for failed runs. They now match a run on Mastra's default workflow engine, where before every failed run returned `status: 'failed'`, `steps: {}` and Temporal's `WorkflowFailedError`. Fixes [#28754](https://github.com/mastra-ai/mastra/issues/28754).

- `error` is the error the step threw, with its own fields such as `code`.
- `steps` has a record for each step that ran, including the failed step and every branch of a `.parallel()`.
- A step that throws a `TripWire`, as an agent step does when a guardrail aborts, returns `status: 'tripwire'` with `tripwire: { reason, retry, metadata, processorId }`.

The run still fails in Temporal. Restart your Workers to pick up the change. Runs that fail on a Worker running an older version return the same result as before.
