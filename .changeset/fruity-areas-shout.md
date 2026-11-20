---
'@mastra/core': patch
---

Fixed default-engine workflow runs being overwritten by a process that stalled past its run lease. When a process stops renewing its lease, for example because its event loop is blocked or its database connection is cut, and another instance takes the run over, storage adapters with run-ownership support (such as PostgreSQL and LibSQL) now refuse the stalled process's writes. That process stops driving the run: it starts no further step, doesn't retry the current one, runs no `onFinish` or `onError` callback, and its `start()`, `resume()` or `restart()` call returns `status: 'waiting'`. Before, it ran the remaining steps again and could flip a finished run back to `running`.

A step that was already running when the run was taken over still finishes, so keep steps idempotent. A second `start()` with the `runId` of a run that is executing now takes the run over the same way. Adapters without run-ownership support keep the previous behavior.
