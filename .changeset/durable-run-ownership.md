---
'@mastra/core': minor
---

Fixed durable agent crash recovery re-running runs that were still executing. Recovery restarted every run left in the `running` state, even when another process was still driving it. Both executions then wrote to the same thread, and the original one could overwrite the recovered assistant messages ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Each run is now claimed by the execution driving it: `stream()`, `generate()`, `resume()`, or `recover()`. The claim is renewed while the run executes and lapses about 30 seconds after its process dies.

- `recoverActiveRuns()` skips runs whose claim is still live. Skipped runs are returned with `status: 'skipped'`, a `reason`, and, for a run live in another process, a `retryAt` time.
- `mastra.recoverAllDurableAgents()` counts skipped runs in a new `skipped` field and checks each one again once its claim could have lapsed, so a run whose process crashed is still recovered.
- `recover()` throws `DURABLE_AGENT_RUN_ACTIVE` for a live run. Pass `force: true` to take the run over. The execution that held it stops.
- `recover()` throws `DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY` for a run the same process is still executing, even with `force: true`. Previously it started a second execution of the run. Wait for the run to finish instead.
- Starting a run with a `runId` that another execution holds waits up to 5 seconds, then throws `DURABLE_AGENT_EXECUTION_CONFLICT`.
- `mastra.shutdown()` releases runs still executing after the drain window, so the next boot recovers them right away.
- Run streams drop events from an execution that lost its run. With a storage adapter that supports run fencing, that execution's writes are also rejected, so it can't overwrite messages, threads, or workflow state. A warning is logged when the workflows or memory store doesn't support run fencing: whenever runs are recovered, through `recoverActiveRuns()` or `recover()`, and, with `recovery: { durableAgents: 'auto' }`, when a run starts.

```ts
const { recovered } = await durableAgent.recoverActiveRuns();

for (const run of recovered) {
  if (run.status === 'skipped' && run.reason === 'run-active') {
    console.log(`${run.runId} is still running. Check again at ${new Date(run.retryAt!)}`);
  }
}

// Take a run over even though another execution still holds it
const stream = await durableAgent.recover(runId, { force: true });
```

See [Run ownership](https://mastra.ai/docs/harness/durable-agents#run-ownership) for how claims are enforced and how recovery works across multiple instances.
