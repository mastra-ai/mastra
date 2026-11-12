---
'@mastra/core': minor
---

Added background process exit notices for agents, and process owner metadata.

**Exit notices**

Set `notifyAgent` in the `backgroundProcesses` option of `execute_command` to tell the agent when a background command exits. The agent's thread gets a notification with the command, the exit code and the end of its output, so the agent can report the result after its turn has ended. An active run sees it on its next step, and an idle thread wakes. Processes stopped on purpose (with `kill_process`, by the run's abort signal, or because the sandbox is shutting down) send no notification. The agent must be registered on the `Mastra` instance, and the run needs a memory thread and resource.

```ts
const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: { notifyAgent: true },
    },
  },
});
```

**Process owners**

`sandbox.processes.spawn()` accepts `metadata` (`threadId`, `resourceId`, `toolCallId`, `startedAt`), and `list()` and `get()` return it. `execute_command` sets it for the processes an agent starts, so hosts can show or scope processes by thread or resource.

```ts
const [proc] = await sandbox.processes.list();
console.log(proc.metadata?.threadId, proc.metadata?.startedAt);
```

**Suspended tasks on reconnect**

The background task stream now also replays suspended tasks, as `background-task-suspended`, when a client connects. A client that reconnects while a task waits for an answer still sees the question.
