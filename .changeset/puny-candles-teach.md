---
'@mastra/code-sdk': minor
---

Added background shells and background subagents to Mastra Code. They are off by default and turn on with the experimental background tools setting. Background subagents also need subagents turned on.

```json
{ "backgroundTools": { "enabled": true }, "preferences": { "subagentsEnabled": true } }
```

- Commands started with `execute_command` and `background: true` keep running when you press Esc. When one exits, the agent gets a notification with the exit code and the end of its output. If the agent is idle on that thread, the notification starts a new turn.
- The `subagent` tool can run as a background task with no time limit. When the task finishes, fails or is cancelled, the agent gets a notification. The result is in the original tool call.
- Background tasks cut off by a crash are marked failed on the next start, and their thread gets a notification that a restart interrupted them.
- `createMastraCode()` returns `backgroundProcesses`, which reads the output of a background shell and kills it without posting an exit notification.
