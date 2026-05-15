---
'@mastra/core': patch
---

Fixed harness subagents so multiple non-forked delegated subagent calls can run in parallel in approval mode. Forked subagents and other tools that require approval keep the existing approval flow.
