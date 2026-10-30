---
'@mastra/core': patch
---

Fixed `subscribeToThread({ withInitialHistory: true })` hanging or rejecting when the lease backend (for example Redis) is slow or unavailable, which also kept `AgentController` sessions from opening. The subscription now opens anyway. If the lease read doesn't answer in time, `activeRunId` in the `thread-history` chunk comes from this process's own view of the thread, and a warning is logged. A run that is still live in another process keeps streaming to the subscriber once the backend answers again. Fixes #28750.
