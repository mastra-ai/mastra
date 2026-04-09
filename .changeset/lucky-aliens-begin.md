---
'@mastra/core': patch
---

Fixed assistant text being lost after tool calls when ObservationalMemory is enabled. In multi-step agent turns, the text generated in step 2 (after a tool call in step 1) was visible during streaming but disappeared on thread reload. The root cause was that when step 1's assistant message was re-tagged as a memory message and step 2 text was merged into it, the message was silently tracked in both the memory and response sets. A subsequent source clear would remove it from response tracking, preventing turn.end() from re-persisting the merged content. Fixes #14926.
