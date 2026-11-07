---
'@mastra/core': patch
---

The agent controller's `command_exit` event now says how a command ended, so clients can show more than a failure code: `killed` when the process was killed, `timedOut` when it ran past its timeout, and `error` when the sandbox could not run it (its `exitCode` is then -1). The `data-sandbox-exit` stream part carries the same `error`. `kill_process` no longer reports an exit code of -1 for a process it could not find. `kill_process` and `get_process_output` also send `command_exit`, for the process they stopped or waited on, so a non-zero exit only means the call itself failed when it comes from `execute_command`.

```ts
session.subscribe(event => {
  if (event.type !== 'command_exit') return;
  if (event.error) showError(event.toolCallId, event.error);
  else if (event.timedOut) showTimedOut(event.toolCallId);
  else if (event.killed) showKilled(event.toolCallId);
  else if (!event.success) showExitCode(event.toolCallId, event.exitCode);
});
```
