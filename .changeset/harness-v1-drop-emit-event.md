---
'@mastra/core': minor
---

harness v1: drop `ctx.emitEvent` from `HarnessRequestContext`

Tools now emit progress and custom signals exclusively through
`ctx.writer?.custom({ type: 'data-*', data })`. Inside a `Session`,
`_drainStreamToEvents` bridges the whitelisted `data-task-updated`,
`data-tool-update`, and `data-shell-output` chunks into the typed
`task_updated` / `tool_update` / `shell_output` harness events. Outside
a `Session`, the same chunks land directly on `agent.stream().fullStream`,
so a tool behaves identically in both environments and there is no
back-channel into harness pub/sub.

Removed surface:
- `HarnessRequestContext.emitEvent`
- `HarnessToolEmitError`
