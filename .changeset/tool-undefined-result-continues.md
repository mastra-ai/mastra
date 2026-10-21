---
'@mastra/core': patch
---

Fixed agents stopping after a server tool whose `execute` returns `undefined`. The tool now records a `null` result, and the agent includes the tool call and result in the next turn.
