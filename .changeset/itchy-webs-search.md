---
'@mastra/core': minor
---

Restarting active workflow runs at boot (`restartAllActiveWorkflowRuns()`) is faster when many runs are active (#28712). Runs that another instance is still running are skipped without being loaded. With 3,000 active runs that another instance is running, among 30,000 finished runs, the restart takes about 30 ms instead of 1.9 s on Postgres and 45 ms instead of 670 ms on LibSQL.

For evented workflows, `restartAllActiveWorkflowRuns()` now resolves once a worker starts each restarted run, not when the run finishes. A long evented run no longer holds a `recovery.workflowConcurrency` slot or delays the restart of other runs.

Storage adapter authors can implement `getRunOwnerships({ runIds })` to read the ownership of many runs in one call. It returns a `Map` keyed by run ID and leaves out runs that were never claimed. Adapters that don't implement it read each run separately.

```ts
const owners = await workflowsStore.getRunOwnerships({ runIds: ['run-1', 'run-2'] });
owners.get('run-1')?.live; // true while another instance holds the run
owners.has('run-2'); // false when run-2 was never claimed
```
