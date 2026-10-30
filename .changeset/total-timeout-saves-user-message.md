---
'@mastra/core': patch
---

Fixed agent runs that hit `modelSettings.timeout.totalMs` losing the turn from memory. The default and filesystem engines now save the user's message and every step that finished before the deadline, including tool calls that completed or were cut off with an abort notice. Read-only memory is respected.
