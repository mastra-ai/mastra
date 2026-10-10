---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` dropping the agent's tools when a run was interrupted during a model request. The recovered model call now gets the same tools as the original run, so it can still call them instead of only replying with text. Fixes #25890.
