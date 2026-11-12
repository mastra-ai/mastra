---
'@mastra/core': patch
---

Fixed evented workflow sleeps being lost when the instance that started them stopped (#30012). A `sleep()` or `sleepUntil()` step now stores the time it ends, and other instances leave the run alone until then. If the instance that started the sleep crashed or shut down, the run is restarted about `recovery.workflowGraceMs` after the sleep's end time and continues with the step after it right away. The sleep wakes once, even when several instances find it. During a broker backlog longer than `MASTRA_AGENT_THREAD_LEASE_TTL_MS` plus `recovery.workflowGraceMs`, a recovery restart can run the step after a sleep again. This needs a storage adapter with run-ownership support and an instance that runs the orchestration worker.

A restart during a sleep resumes the rest of the sleep, and a restart after the sleep ended continues with the next step, even when the sleep has no `id` and the restart runs on another instance. A run that was already in a sleep when you upgrade is restarted once, and its sleep starts over. A woken sleep now reports `success` in the run's step results, as it does on the default engine. When storage or the pubsub fails a wake, the instance that started the sleep tries again, even with `recovery.workflows` set to `'off'`.

Each sleep adds two `workflows.runOwnership` records, and each sleeping run one more. If you prune that table, keep its `maxAge` above your longest sleep: pruning it sooner lets recovery restart a sleeping run before its sleep ends, and the restart resumes the rest of the sleep. Redis, Valkey and Upstash keep these records for 7 days, so a run in a longer sleep is restarted about once a week, and each restart resumes the rest of the sleep.
