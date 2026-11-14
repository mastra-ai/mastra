---
'@mastra/core': minor
---

Added run metadata to background process callbacks.

`backgroundProcesses` callbacks on `execute_command` now receive, when available, the `agentId`, `threadId`, `resourceId`, and `runId` of the call that started the process, so hosts can route exit notices to the right conversation. `onExit` also receives `killedByAbort`, which is `true` when the abort signal fired (the run's signal by default) and killed the process.

```ts
backgroundProcesses: {
  onExit: ({ pid, exitCode, threadId, killedByAbort }) => {
    if (!killedByAbort) notifyThread(threadId, `Process ${pid} exited with code ${exitCode}`);
  },
},
```

`truncateOutput` and `DEFAULT_TAIL_LINES` are now exported from `@mastra/core/workspace`, so hosts can trim process output the same way `execute_command` does.
