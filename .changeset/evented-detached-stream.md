---
'@mastra/core': patch
---

Fixed an evented agent stream with remote workers that stayed open after the run ended, when the run ended before its last event reached the caller.
