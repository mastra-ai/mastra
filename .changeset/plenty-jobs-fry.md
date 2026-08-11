---
'@mastra/core': minor
'@mastra/factory': patch
---

Added a `command_exit` session event to the agent controller. Subscribers now receive the exit code and success flag of each foreground `execute_command` tool call, alongside the existing `shell_output` stream:

```typescript
session.subscribe(event => {
  if (event.type === 'command_exit') {
    console.log(event.toolCallId, event.exitCode, event.success);
  }
});
```

Previously the exit outcome was only visible inside the tool result text, so observers could stream a command's output but never tell whether it succeeded.
