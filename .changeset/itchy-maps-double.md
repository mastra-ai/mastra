---
'@mastra/temporal': patch
---

Fixed `run.start()` results for failed runs. Before, every failed run returned `status: 'failed'`, `steps: {}` and Temporal's `WorkflowFailedError`. A failed run now returns the same status, error, tripwire and step records as on Mastra's default workflow engine. Fixes [#28754](https://github.com/mastra-ai/mastra/issues/28754).

- `error` is the error the step threw, with its own fields such as `code`.
- `steps` has a record for each step that ran, including the failed step and every branch of a `.parallel()`. As in successful Temporal results, it has no `input` record.
- A step that throws a `TripWire`, as an agent step does when a guardrail aborts, returns `status: 'tripwire'` with `tripwire: { reason, retry, metadata, processorId }`.

Restart your Workers to pick up the change. Runs that fail on a Worker running an older version return the same result as before.

**Changes if you read Temporal failures directly**

The run still fails in Temporal, but with a different failure chain. If you call `handle.result()` with the Temporal client, `WorkflowFailedError.cause` is now an `ApplicationFailure` carrying the step's error. The step's `ActivityFailure`, including input and request context validation failures, is one level lower in its `cause`. Code that checks `cause instanceof ActivityFailure` or the top-level failure `type` needs to look one level deeper:

```ts
// Before
if (error.cause instanceof ActivityFailure) {
  // handle the step's failure
}

// After
if (error.cause instanceof ApplicationFailure && error.cause.cause instanceof ActivityFailure) {
  // handle the step's failure
}
```

**`.parallel()` waits for every branch**

When a branch fails, the run now waits for the other branches to finish before it fails, as on the default engine. Before, it failed as soon as one branch failed. The other branches run to completion, side effects included. If a branch retries indefinitely, the run doesn't fail until that branch stops. Set `retry` in `init()` to limit retries.
