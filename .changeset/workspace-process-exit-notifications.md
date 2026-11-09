---
'@mastra/core': minor
---

Added exit notifications for workspace commands the agent is no longer waiting on. When a command started with `execute_command` and `background: true` exits, the agent that started it gets a notification with the exit code and the last lines of output, and an idle thread is woken by it. The agent no longer has to poll `get_process_output`.

Foreground commands no longer block the agent indefinitely. A foreground command still running after 30 seconds moves to the background: the tool returns the output so far and the PID, the command keeps running, and the agent is notified when it exits.

`get_process_output` now takes `waitSeconds` (1 to 300) instead of `wait: true`, so waiting on a process that never exits no longer hangs the agent. When the wait runs out, or the run is cancelled, the tool returns the output so far and the process keeps running. Waits never go past `foregroundDetachMs`.

```ts
const workspace = new Workspace({
  sandbox,
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      foregroundDetachMs: 10 * 60_000, // or false to always wait
      backgroundProcesses: { notifyOnExit: false }, // turn off exit notifications
    },
  },
});
```

Notifications need the `notifications` storage domain and are skipped for processes that were killed.
