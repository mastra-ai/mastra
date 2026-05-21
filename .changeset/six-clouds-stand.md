---
'@mastra/core': minor
---

The workspace `execute_command` tool now wakes the invoking agent with a `system-reminder` signal when a background process (`background: true`) exits. This means an agent that stops talking while a long-running task is still running will resume the moment the task finishes, with the exit code and (truncated) stdout/stderr injected as a system reminder.

**Behavior change**

Previously, background processes exited silently. Now, by default, agents receive an `agent.sendSignal` on exit. The signal only fires when the tool was invoked from a real agent run (so workflow/CLI invocations are unaffected). Opt out with `signalOnExit: false`.

**Examples**

```ts
// Default — agent is woken with a system-reminder when the bg process exits.
workspace.setToolsConfig({
  mastra_workspace_execute_command: {
    backgroundProcesses: {
      // signalOnExit defaults to true
    },
  },
});

// Opt out:
workspace.setToolsConfig({
  mastra_workspace_execute_command: {
    backgroundProcesses: { signalOnExit: false },
  },
});

// Customize: only wake the agent on non-zero exit, with a custom payload.
workspace.setToolsConfig({
  mastra_workspace_execute_command: {
    backgroundProcesses: {
      signalOnExit: (exit) =>
        exit.exitCode === 0
          ? undefined
          : {
              type: 'system-reminder',
              contents: `pid ${exit.pid} failed (${exit.exitCode}): ${exit.stderr}`,
              attributes: { pid: exit.pid, exitCode: exit.exitCode },
            },
    },
  },
});
```

**Lower-level escape hatch**

The `onStdout`, `onStderr`, and `onExit` background callbacks also receive `mastra`, `agentId`, `threadId`, and `resourceId` so you can dispatch signals (or anything else) yourself if `signalOnExit` doesn't fit. All four fields are populated only when the tool is invoked inside an agent run.
