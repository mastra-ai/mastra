---
'@mastra/core': minor
---

Added channel tool lifecycle hooks and best-effort channel status runtime helpers.

Use `onToolStart` and `onToolEnd` to run side effects while tools execute. Use `channel.status.set()` to show platform status text when the adapter supports it.

`formatToolCall` now receives completed tool metadata, including display name, tool call ID, thread, platform, duration, and error state.
