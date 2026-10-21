---
'@mastra/core': patch
---

Fixed an agent run that had lost its thread lease running tools next to the run that took over the thread. Lease renewals run every third of the lease TTL, so a run whose lease was taken over could keep calling tools until its next renewal. A run that holds a thread lease now checks the lease owner before each tool call. If another run owns the lease, the run is aborted and the tool does not run. If the lease backend can't answer, the local lease deadline decides as before.
