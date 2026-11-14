---
'@mastra/code-sdk': minor
---

Added background shells to Mastra Code. They are off by default and turn on with the experimental background tools setting in `settings.json`:

```json
{ "backgroundTools": { "enabled": true } }
```

- Commands started with `execute_command` and `background: true` keep running when you press Esc. When one exits, the agent gets a notification with the exit code and the end of its output. If the agent is idle on that thread, the notification starts a new turn.
- `BackgroundCompletionEvent` from `@mastra/code-sdk/agents/background-completion-events` now also covers background shell exits, with `kind: 'process'`. Task completion events now include `kind: 'task'`, so a host that publishes its own task events must set it. Check `kind` before reading `taskId`.
- `createMastraCode()` returns `backgroundProcesses`, which reads a background shell's output and kills it. Killing a shell through it doesn't post an exit notification. `read` still works after the shell exits, until a kill or `get_process_output` releases it:

```ts
const { backgroundProcesses } = await createMastraCode();
const handle = await backgroundProcesses?.read(pid);
await backgroundProcesses?.kill(pid);
```
