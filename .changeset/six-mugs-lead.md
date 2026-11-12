---
'@mastra/core': minor
---

Added background subagents and richer background process exit metadata.

**Background subagents**

Set `subagentBackground` on `AgentController` to let the built-in `subagent` tool run as a background task. The parent agent keeps working while the subagent runs, and the answer replaces the placeholder in the original tool call when it finishes. A deferred subagent stops when its task is cancelled or times out, not when the parent run is aborted. An awaited subagent also stops when the parent run is aborted, and its task ends cancelled. A background subagent that fails ends its task as failed and fires `onTaskFailed`.

```ts
const controller = new AgentController({
  id: 'assistant-controller',
  agent,
  storage,
  modes: [{ id: 'build', name: 'Build', default: true }],
  backgroundTasks: { enabled: true },
  subagents,
  subagentBackground: { enabled: true, defaultDisposition: 'foreground', timeoutMs: 0 },
});
```

**Background process metadata**

`backgroundProcesses` callbacks on `execute_command` now receive, when available, the `agentId`, `threadId`, `resourceId`, and `runId` of the call that started the process, so hosts can route exit notices to the right conversation. `onExit` also receives `killedByAbort`, which is `true` when the run's abort signal killed the process.

```ts
backgroundProcesses: {
  onExit: ({ pid, exitCode, threadId, killedByAbort }) => {
    if (!killedByAbort) notifyThread(threadId, `Process ${pid} exited with code ${exitCode}`);
  },
},
```

`truncateOutput` and `DEFAULT_TAIL_LINES` are now exported from `@mastra/core/workspace`.

`buildBasePrompt` accepts `backgroundSubagents: true` to leave out the rule to use subagents only for parallel work.
