---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed long-running agent processes (such as Mastra Code sessions left open for days) losing their thread lease mid-run with "lost its lease before publishing a terminal event". Temp-directory cleaners could delete the file that marks the process as alive, after which the process's own leases looked abandoned. The marker is now restored whenever it goes missing. Also kept a custom reason passed to `abortSignal` intact for the run.
