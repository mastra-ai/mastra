---
'@mastra/core': minor
---

Added an opt-in lifetime limit for background processes, so a hung command stops instead of running until the sandbox restarts.

**Background lifetime limits**

Set `defaultTimeoutMs` and `maxTimeoutMs` on the `execute_command` `backgroundProcesses` tool options:

```typescript
const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: {
        defaultTimeoutMs: 10 * 60_000,
        maxTimeoutMs: 30 * 60_000,
      },
    },
  },
});
```

`defaultTimeoutMs` applies when the agent omits `timeout`. `maxTimeoutMs` caps a larger timeout and also applies to `timeout: 0`. Leaving them unset keeps today's behavior, so dev servers keep running. The tool result now says when the process will be stopped, and `onExit` reports `timedOut`.

**Configurable kill grace**

`LocalSandbox` now accepts `killGraceMs` (default 2000) to control how long a timed-out process gets after `SIGTERM` before it is sent `SIGKILL`.

See [#30039](https://github.com/mastra-ai/mastra/issues/30039).
