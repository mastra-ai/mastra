---
'@mastra/core': minor
---

Added opt-in lifetime limits for background processes started by `execute_command`. Set `defaultTimeoutMs` to stop background processes the agent starts without a `timeout`, and `maxTimeoutMs` to cap any requested timeout. When a limit applies, the tool result tells the agent when the process will be stopped, and `onExit` now reports `timedOut`. With neither option set, behavior is unchanged.

```typescript
const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: {
        defaultTimeoutMs: 10 * 60_000,
        maxTimeoutMs: 60 * 60_000,
        onExit: ({ pid, timedOut }) => {
          if (timedOut) console.log(`Process ${pid} hit its time limit`);
        },
      },
    },
  },
});
```
