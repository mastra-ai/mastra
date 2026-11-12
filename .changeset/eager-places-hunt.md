---
'@mastra/core': minor
---

Added background process exit notices for agents, process owner metadata, and a way to read a cached sandbox without creating one.

**Exit notices**

Set `notifyAgent` in the `backgroundProcesses` option of `execute_command` to tell the agent when a background command exits. The agent's thread gets a notification with the command, the exit code and the end of its output, so the agent can report the result after its turn has ended. An active run sees it on its next step, and an idle thread wakes. Processes stopped on purpose (with `kill_process` or `sandbox.processes.kill()`, by the run's abort signal, or because the sandbox is shutting down) send no notification. The agent must be registered on the `Mastra` instance, and the run needs a memory thread and resource. Set `abortSignal: null` too: by default, aborting the run kills the process, and that exit sends no notification.

```ts
const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: { notifyAgent: true, abortSignal: null },
    },
  },
});
```

`onExit` also receives `killedOnRequest`, which is `true` when `kill_process`, the HTTP kill route or `sandbox.processes.kill()` stopped the process.

**Process owners**

`sandbox.processes.spawn()` accepts `metadata` (`threadId`, `resourceId`, `toolCallId`, `startedAt`), and `list()` and `get()` return it. `execute_command` sets it for the processes an agent starts, so hosts can show or scope processes by thread or resource.

```ts
const [proc] = await sandbox.processes.list();
console.log(proc.metadata?.threadId, proc.metadata?.startedAt);
```

**Cached sandbox lookup**

`workspace.getCachedSandbox({ requestContext })` returns the sandbox already cached under the request's `sandboxCacheKey` without running the resolver, so hosts can read sandbox state without creating a sandbox.

```ts
const sandbox = await workspace.getCachedSandbox({ requestContext });
if (sandbox?.status === 'running') console.log(await sandbox.processes?.list());
```

**Suspended tasks on reconnect**

The background task stream now also replays suspended tasks, as `background-task-suspended`, when a client connects. A client that reconnects while a task waits for an answer still sees the question.
