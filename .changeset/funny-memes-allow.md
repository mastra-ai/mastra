---
'@mastra/core': minor
---

Added forked subagents: a new `forked` flag on `HarnessSubagent` definitions and the built-in `subagent` tool input. When set, the subagent runs on a clone of the parent thread using the parent agent's instructions and tools, preserving prompt-cache prefix while isolating writes from the main conversation.
