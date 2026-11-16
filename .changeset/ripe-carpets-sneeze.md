---
'@mastra/core': patch
---

Fixed durable agents never generating a thread title when observational memory is passed in the call's `memory.options`. These threads now get a title, as they do with a regular agent. Fixes #30478.

Durable title saves now only update the title. They no longer overwrite thread metadata written while the title was generating, such as observational memory's progress, and no longer re-create a thread that was deleted during the run.
