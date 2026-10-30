---
'@mastra/core': patch
---

Fixed agent runs that hit `modelSettings.timeout.totalMs` losing the turn from memory. The default and filesystem engines now save the user's message and every step that finished before the deadline, including tool calls that completed or were cut off with an abort notice, plus the text the model had already streamed. Data parts that output processors write at the end of the turn are saved too. Read-only memory and memory write permissions are respected.
