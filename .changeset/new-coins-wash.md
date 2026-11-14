---
'@mastra/playground-ui': minor
---

The chat components now show background work and can kill background commands. Wrap the chat in `BackgroundWorkProvider` (from `domains/chat/background/background-work-provider`) with its messages, and set the new `threadId` on `ChatAgentContext`, to turn it on.

- A command the agent starts with `execute_command` and `background: true` shows as a running background command with a `Background` tag until it exits, then shows its exit code. It is never folded into a group of finished calls. Without the provider it keeps the plain command card.
- Exit notices and finished or failed background tasks get their own row in the transcript.
- `BackgroundWorkPanel` lists the thread's running background commands and tasks with how long they have run. Expand a row to see its latest output. A command can be killed after confirming; tasks are listed read-only.

The exit code shows as soon as the process exits when the workspace sends exit notices:

```ts
import { Workspace, LocalSandbox, WORKSPACE_TOOLS } from '@mastra/core/workspace';

const workspace = new Workspace({
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: {
      backgroundProcesses: { notifyAgent: true },
    },
  },
});
```

Without exit notices, the card reads the sandbox's process list while the process runs.
