---
'@mastra/core': patch
---

Channel streaming: text the agent writes before its first tool call now posts as its own message in `toolDisplay: 'grouped'` mode. An opening acknowledgement lands above the Thinking Steps widget instead of under it.

The plan widget in `'grouped'` and `'timeline'` modes is quieter. The header is a fixed "Working…" label and no longer echoes the current tool. Each task row shows the tool's `description` argument (first line only) when it has one, and falls back to `toolName firstArg` otherwise.
