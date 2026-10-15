---
'@mastra/core': patch
---

Fixed `untilIdle` continuation turns missing a completed background task's result once newer messages pushed it outside the `lastMessages` history window. The messages for the tool calls the continuation reports are now always loaded into its prompt.
