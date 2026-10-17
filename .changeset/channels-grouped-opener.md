---
'@mastra/core': patch
---

Channel streaming in `toolDisplay: 'grouped'` mode now posts any text the agent writes before its first tool call as its own message, so an opening acknowledgement lands in the thread before the Thinking Steps widget instead of being folded under it.

The widget itself is quieter: its header is a fixed "Working…" label instead of echoing the current tool, and each task row shows the tool's `description` argument alone when one is present (falling back to `toolName firstArg` otherwise), so a single-tool run no longer reads the same line twice.
