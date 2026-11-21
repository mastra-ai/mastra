---
'@mastra/core': patch
---

Fixed default-engine workflow runs being overwritten by a process that stalled past its run lease. When a process stops renewing its lease, for example because its event loop is blocked or its database connection is cut, and another instance takes the run over, storage adapters with run-ownership support (such as PostgreSQL and LibSQL) now refuse the stalled process's writes. That process stops driving the run: it starts no further step, doesn't retry the current one, runs no `onFinish` or `onError` callback, and its `start()`, `resume()` or `restart()` call returns `status: 'waiting'`. The run goes on in the other instance, so read it with `getWorkflowRunById()` for its current status. Before, the stalled process ran the remaining steps again and could flip a finished run back to `running`.

A step that was already running when the run was taken over still finishes, so keep steps idempotent. A second `start()` with the `runId` of a run that's executing now takes the run over the same way. Adapters without run-ownership support keep the previous behavior.

On adapters with run-ownership support, each write a default-engine run makes now checks the run's ownership in the same operation. On PostgreSQL that makes each write a short transaction that locks the run's ownership row, about 2 ms more per snapshot write against a local database. Set `idle_in_transaction_session_timeout` so a connection cut in the middle of a write doesn't hold that lock and delay the takeover.

Durable agents on the default engine: workflow runs that a `.foreach()` step starts inside the agent's workflow now carry the agent's execution fence, as they already did on the evented engine, so their writes are refused once another execution takes the agent's run over.
