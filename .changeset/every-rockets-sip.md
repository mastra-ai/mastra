---
'@mastra/core': patch
---

Fixed harness subagents so multiple non-forked delegated subagent calls can run in parallel in approval mode. Non-forked subagent dispatches are now treated as an internal safe tool call at the parent level, while forked subagents and ordinary approval-gated tools still preserve approval behavior.
