---
'@mastra/core': patch
---

Fixed agent thread streams on multi-process deployments deciding whether a run was alive, suspended, or finished from local events alone. A follower that sees the thread lease disappear now reads the stored run status: a suspended run surfaces as suspended, a still-running run gets one extra lease TTL to be recovered, and a finished run completes instead of erroring with `AgentThreadLeaseLostError`. A replayed `run-suspended` event no longer blocks the thread when storage says the run already finished.

Thread lease owners are now `<processId>/<runId>`, so a run resumed on another process no longer shares a lease identity with the process that started it. A run whose lease key disappears while it is still executing re-acquires it instead of silently stopping renewal, and `mastra.shutdown()` now releases this process's thread leases and publishes `run-suspended` for runs parked on approval, so other processes can pick them up immediately instead of waiting for the TTL.

During a rolling deploy, processes on an older version compare lease owners to bare run ids and may report one spurious lease-lost error for a run owned by an upgraded process.
