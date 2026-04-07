---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed observational memory repro captures for buffering runs.

Buffering now writes observer exchange debug files just like threshold observation runs. This makes it easier to inspect what the observer model saw and returned when debugging buffered memory behavior.

Improved observer history formatting so rendered message history groups content by part timestamps more consistently.
