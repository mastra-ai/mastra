---
'@mastra/core': patch
---

Fixed missing traces for evented workflow runs started with `startAsync()`. When the process also runs workflow workers, the trace now shows the run and its steps, as it does for `start()`. Also fixed finished `startAsync()` runs staying in memory.
