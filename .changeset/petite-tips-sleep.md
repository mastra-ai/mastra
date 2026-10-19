---
'@mastra/core': patch
---

Fixed trajectory scorers in `runEvals` and dataset experiments getting a flat list of tool calls instead of the full trace when storage is configured. `runEvals` also no longer waits up to 6 seconds per item before scoring.
