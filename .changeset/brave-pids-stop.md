---
'@mastra/core': patch
---

The agent controller's `command_exit` event now carries `killed`, so clients can tell a process that was killed from one that exited with a failure code.

```ts
session.subscribe(event => {
  if (event.type !== 'command_exit') return;
  if (event.killed) showKilled(event.toolCallId);
  else if (!event.success) showExitCode(event.toolCallId, event.exitCode);
});
```
