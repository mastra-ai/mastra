---
'@mastra/code-sdk': minor
---

Added background shells and background subagents to Mastra Code. They are off by default and turn on with the experimental background tools setting. Background subagents also need subagents turned on. In `settings.json`:

```json
{ "backgroundTools": { "enabled": true }, "preferences": { "subagentsEnabled": true } }
```

- Commands started with `execute_command` and `background: true` keep running when you press Esc. When one exits, the agent gets a notification with the exit code and the end of its output. If the agent is idle on that thread, the notification starts a new turn.
- The `subagent` tool can run as a background task with no time limit. When the task finishes, fails or is cancelled, the agent gets a notification. The result is in the original tool call.
- Completions of every background task now wake an idle agent on the current thread. Before, they were only saved to the thread.
- Background tasks cut off by a crash or a shutdown are reported as interrupted. Their notifications are saved to the thread without starting a new turn.
- The completion text changed from `<tool> completed in background` to `↳ <tool> finished`.
- `BackgroundCompletionEvent` from `@mastra/code-sdk/agents/background-completion-events` now also covers background shell exits, with `kind: 'process'`. Task events include `kind: 'task'`. Check `kind` before reading `taskId`.
- `createMastraCode()` returns `backgroundProcesses`, which reads the output of a running background shell and kills it without posting an exit notification:

```ts
const { backgroundProcesses } = await createMastraCode();
const handle = await backgroundProcesses?.read(pid);
await backgroundProcesses?.kill(pid);
```

- Plugin tool render configs accept `expandOnComplete`. By default a finished background subagent box stays compact. Set it to `true` to expand it.
