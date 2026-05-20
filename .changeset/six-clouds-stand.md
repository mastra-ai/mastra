---
'@mastra/core': minor
---

Added agent context (`mastra`, `agentId`, `threadId`, `resourceId`) to the `onStdout`, `onStderr`, and `onExit` callbacks of `mastra_workspace_execute_command`'s `backgroundProcesses` config. This lets callbacks dispatch agent signals when a background process exits — for example, waking an idle agent with a `system-reminder` so it can react to the result of a long-running task.

**Example**

```ts
workspace.setToolsConfig({
  mastra_workspace_execute_command: {
    backgroundProcesses: {
      onExit: ({ pid, exitCode, stdout, stderr, mastra, agentId, threadId, resourceId }) => {
        if (!mastra || !agentId || !threadId || !resourceId) return;
        mastra.getAgentById(agentId).sendSignal(
          {
            type: 'system-reminder',
            contents: `Background process ${pid} exited with code ${exitCode}.\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`,
            attributes: { pid, exitCode },
          },
          { resourceId, threadId },
        );
      },
    },
  },
});
```

All new fields are optional and only populated when the tool runs inside an agent context, so existing callbacks keep working unchanged.
