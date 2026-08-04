---
'@mastra/core': patch
---

Fixed dropped non-text stream parts when `emitOnNonText: false`.

Tool calls, tool results, objects, and reasoning parts now stay in order with the text output instead of being silently lost during batching.
