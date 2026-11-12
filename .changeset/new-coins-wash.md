---
'@mastra/playground-ui': minor
---

Show and control background work in the Studio agent chat.

- A command the agent starts with `execute_command` and `background: true` shows as a running background command with a `Background` tag until it exits, then shows its exit code. It is never folded into a group of finished calls.
- Exit notices and finished background tasks get their own `↳ ... finished` row in the transcript.
- A panel above the composer lists the thread's running background commands and tasks with how long they have run. Expand a row to see its latest output, or stop it: kill a command or cancel a task after confirming.

The exit code shows as soon as the process exits when the workspace sends exit notices:

```ts
import { Workspace, LocalSandbox, WORKSPACE_TOOLS } from '@mastra/core/workspace';

const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: { notifyAgent: true, abortSignal: null },
    },
  },
});
```

Without exit notices, Studio reads the sandbox's process list while the process runs.
