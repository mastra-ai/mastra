---
'@mastra/core': patch
---

Fixed `subscribeToThread({ withInitialHistory: true })` hanging when the lease backend stalls and rejecting when it fails. Since `thread-history` started reporting `activeRunId`, opening the subscription waited on a lease-owner read that had no deadline and no error handling, so a slow or unavailable Redis also kept `AgentController` sessions from opening. The subscription now opens regardless: the read waits at most one lease renewal interval, and when it times out or fails, `activeRunId` comes from this process's own view of the thread and a warning is logged. The lease check that decides whether another process's run is still live gets the same bound, so a run registered elsewhere can't hold the subscription either. Fixes #28750.
