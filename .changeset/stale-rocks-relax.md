---
'@mastra/core': minor
---

Added `onToolStart` and `onToolEnd` hooks for channel adapters.

Use these hooks to run side effects while tools execute. Use `channel.status.set()` to show platform status text when the adapter supports it.

`formatToolCall` now receives completed tool metadata, including display name, tool call ID, thread, platform, duration, and error state.
